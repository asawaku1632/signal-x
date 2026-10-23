/**
 * Independent OWNER-only night-candidate holding comparison.
 * Observation-only: never feeds AI models, alerts, live prices or trading.
 * All indices are trade-date + code, without hindsight candidate selection.
 */
import {jstParts} from "./entryTimeShadow.mjs";

export const NIGHT_HOLDING_POLICY="FROZEN_NIGHT_ENTRY_HOLDING_V1";
export const NIGHT_HOLDING_SLOTS=Object.freeze([
  "PREVIOUS_REFERENCE","09:00","09:05","09:15","09:30",
]);
export const NIGHT_HOLDING_HORIZONS=Object.freeze([0,1,3,5]);
export const NIGHT_HOLDING_MIN_STOCK_DAYS=30;
export const NIGHT_HOLDING_MIN_DAYS=10;
const numericPositive=value=>{
  if(value===null||value===undefined||value==="")return null;
  const valueNumber=Number(value);
  return Number.isFinite(valueNumber)&&valueNumber>0?valueNumber:null;
};
const validDate=date=>/^\d{4}-\d{2}-\d{2}$/.test(String(date??""))&&!Number.isNaN(Date.parse(date+"T00:00:00Z"));
const asDate=date=>new Date(date+"T00:00:00Z");
const dateShift=(date,offset)=>new Date(asDate(date).getTime()+offset*86_400_000).toISOString().slice(0,10);
const jstMs=(date,time)=>Date.parse(date+"T"+time+":00+09:00");

/** The only new bar observations. Yahoo timestamps mark the start of each
 * five-minute candle; OPEN is indicative, never an exchange execution price.
 * This function is called on the EXISTING <=5-symbol after-close request.
 */
export function captureHoldingEntryAnchors(tradeDate,code,candles){
  if(!validDate(tradeDate)||!/^[0-9]{4}$/.test(String(code)))throw Error("INVALID_ANCHOR_TARGET");
  const slots=["09:00","09:05","09:15","09:30"];
  const observed=new Map();
  for(const c of Array.isArray(candles)?candles:[]){
    if(!Number.isSafeInteger(c?.time)||c.time<=0)continue;
    const t=jstParts(c.time*1000);
    if(t.date!==tradeDate||!slots.includes(t.hhmm)||observed.has(t.hhmm))continue;
    observed.set(t.hhmm,numericPositive(c.open));
  }
  return {version:NIGHT_HOLDING_POLICY,tradeDate,code:String(code),
    entries:slots.map(time=>({time,price:observed.get(time)??null,
      source:"YAHOO_5M_OPEN"}))};
}

/** Target calendar dates must be actual exchange sessions, not weekdays.
 * Holidays are not counted; missing target dates cannot be filled from later.
 */
export function holdingTradingDates(tradeDate,isTradingDate){
  if(!validDate(tradeDate)||typeof isTradingDate!=="function")throw Error("CALENDAR_REQUIRED");
  if(!isTradingDate(tradeDate))throw Error("TRADE_DATE_CLOSED");
  const out={0:tradeDate};
  let found=0;
  for(let i=1;i<=24&&found<5;i++){
    const date=dateShift(tradeDate,i);
    if(!isTradingDate(date))continue;
    found++;
    if([1,3,5].includes(found))out[found]=date;
  }
  if(found!==5)throw Error("HORIZON_DATE_UNRESOLVED");
  return out;
}

function freezeValid(r){
  const tradeDate=String(r?.trade_date??"");
  const priorDate=String(r?.prior_date??"");
  const timestamp=Date.parse(String(r?.frozen_at??""));
  return validDate(tradeDate)&&validDate(priorDate)&&
    Number.isFinite(timestamp)&&
    timestamp>=jstMs(priorDate,"18:00")&&timestamp<jstMs(tradeDate,"09:00")&&
    Array.isArray(r?.cohort)&&r.cohort.length>=1&&r.cohort.length<=5;
}

function lateSnapshot(row,expectedDate,nowMs){
  if(String(row?.date)!==expectedDate)return null;
  const price=numericPositive(row?.price);
  const savedAt=Date.parse(String(row?.created_at??""));
  // The scan snapshot is NOT certified closing price; only saved post-market
  // snapshots are usable as future-day indicative references.
  if(price===null||!Number.isFinite(savedAt)||
    savedAt<jstMs(expectedDate,"15:35")||savedAt>nowMs)return null;
  return price;
}

function matchedMorningGate(run,candidate,referenceEntry){
  const saved=Date.parse(String(run.morning_saved_at??""));
  const date=String(run.trade_date);
  if(!["COMPLETE","PARTIAL"].includes(run.morning_state)||
     !Number.isFinite(saved)||saved<jstMs(date,"09:05")||
     saved>jstMs(date,"09:19")||
     !Array.isArray(run.morning_observations)||
     numericPositive(referenceEntry)===null)return null;
  const matches=run.morning_observations.filter(m=>
    String(m?.code)===String(candidate.code));
  if(matches.length!==1)return null;
  const m=matches[0];
  if(!["BUY_CANDIDATE","CAUTION","SKIP"].includes(m.label)||
     Number(m.priorScore)!==Number(candidate.score)||
     Math.abs(Number(m.priorReferencePrice)-Number(candidate.referencePrice))>0.001||
     numericPositive(m.price0905)===null||
     Math.abs(Number(m.price0905)-referenceEntry)>0.01)return null;
  return m.label;
}

const mapArchive=archiveRuns=>{
  const map=new Map();
  for(const run of Array.isArray(archiveRuns)?archiveRuns:[]){
    if(!validDate(run?.trade_date)||!Array.isArray(run.results)||
      !["COMPLETE","PARTIAL"].includes(run.status)||!run.finished_at)continue;
    for(const result of run.results){
      const key=run.trade_date+":"+String(result?.code??"");
      if(!map.has(key)&&result?.date===run.trade_date&&
        result.complete===true&&numericPositive(result.closePrice)!==null)
        map.set(key,{run,result});
    }
  }
  return map;
};

/** No backfilling/fabricated 9:15 bar: earlier archives that lack the
 * optional anchors simply show "missing". Strict matched night freeze.
 */
export function buildNightHoldingStudy({frozenRuns,archiveRuns,priceRows,isTradingDate,now}){
  if(typeof isTradingDate!=="function")throw Error("CALENDAR_REQUIRED");
  const nowMs=new Date(now).getTime();
  if(!Number.isFinite(nowMs))throw Error("INVALID_NOW");
  const archives=mapArchive(archiveRuns);
  const snapshots=new Map();
  for(const row of Array.isArray(priceRows)?priceRows:[]){
    if(!validDate(row?.date)||!/^[0-9]{4}$/.test(String(row?.code??"")))continue;
    const key=row.date+":"+row.code;
    const value=lateSnapshot(row,row.date,nowMs);
    if(value!==null&&!snapshots.has(key))snapshots.set(key,value);
  }
  const rows=[],seen=new Set();
  for(const run of Array.isArray(frozenRuns)?frozenRuns:[]){
    if(!freezeValid(run))continue;
    const tradeDate=String(run.trade_date);
    if(jstMs(tradeDate,"15:35")>nowMs)continue;
    let targetDates;
    try{targetDates=holdingTradingDates(tradeDate,isTradingDate);}catch{continue;}
    const archived=archives;
    for(const candidate of run.cohort){
      const code=String(candidate?.code??"");
      if(!/^[0-9]{4}$/.test(code)||seen.has(tradeDate+":"+code))continue;
      const nightly=numericPositive(candidate.referencePrice);
      const score=Number(candidate.score);
      if(nightly===null||!Number.isFinite(score)||score<85||score>100)continue;
      const matched=archived.get(tradeDate+":"+code);
      if(!matched||matched.run.prior_date!==run.prior_date)continue;
      const result=matched.result;
      if(Number(result.priorScore)!==score||
        Math.abs(Number(result.priorReferencePrice)-nightly)>0.001)continue;
      seen.add(tradeDate+":"+code);
      const anchor=result.holdingAnchors;
      const anchorMatch=anchor?.version===NIGHT_HOLDING_POLICY&&
        anchor.tradeDate===tradeDate&&anchor.code===code&&
        Array.isArray(anchor.entries);
      // Existing 09:05/09:30 archive contains retrospective reference opens;
      // no attempt to manufacture earlier missing 09:00 / 09:15 bars.
      const legacy=time=>numericPositive(result.entries?.find(e=>e.time===time)?.entryPrice);
      const anchored=time=>anchorMatch?
        numericPositive(anchor.entries.find(e=>e.time===time)?.price):null;
      const entries={
        PREVIOUS_REFERENCE:nightly,
        "09:00":anchored("09:00"),
        "09:05":anchored("09:05")??legacy("09:05"),
        "09:15":anchored("09:15"),
        "09:30":anchored("09:30")??legacy("09:30"),
      };
      const exits={
        0:numericPositive(result.closePrice),
        1:snapshots.get(targetDates[1]+":"+code)??null,
        3:snapshots.get(targetDates[3]+":"+code)??null,
        5:snapshots.get(targetDates[5]+":"+code)??null,
      };
      const morningGate=matchedMorningGate(run,candidate,entries["09:05"]);
      rows.push({date:tradeDate,code,name:String(candidate.name??code),
        score,freezeAt:run.frozen_at,targetDates,entries,exits,morningGate});
    }
  }
  rows.sort((a,b)=>b.date.localeCompare(a.date)||a.code.localeCompare(b.code));
  return rows;
}

export function summarizeNightHolding(rows){
  return NIGHT_HOLDING_HORIZONS.map(horizon=>{
    // Identical stock-days contribute to every entry strategy inside ONE horizon.
    const paired=(Array.isArray(rows)?rows:[]).filter(row=>
      numericPositive(row.exits?.[horizon])!==null&&
      NIGHT_HOLDING_SLOTS.every(slot=>numericPositive(row.entries?.[slot])!==null));
    const days=new Set(paired.map(r=>r.date)).size;
    const sufficient=paired.length>=NIGHT_HOLDING_MIN_STOCK_DAYS&&days>=NIGHT_HOLDING_MIN_DAYS;
    const comparison=NIGHT_HOLDING_SLOTS.map(slot=>{
      const pnls=paired.map(row=>(row.exits[horizon]-row.entries[slot])*100);
      return {slot,count:paired.length,avgPnl100:sufficient?
        pnls.reduce((sum,p)=>sum+p,0)/pnls.length:null,
        wins:sufficient?pnls.filter(n=>n>0).length:null,
        winRate:sufficient?100*pnls.filter(n=>n>0).length/pnls.length:null};
    });
    return {horizon,paired:paired.length,days,sufficient,comparison};
  });
}

export function holdingPnl100(row,slot,horizon){
  const entry=numericPositive(row?.entries?.[slot]),exit=numericPositive(row?.exits?.[horizon]);
  return entry===null||exit===null?null:Number(((exit-entry)*100).toFixed(2));
}

/** Gate-only counterfactual, separate from the all-buy entry comparison:
 * only genuinely saved 09:05 morning observations are counted. CAUTION/SKIP
 * means no purchase (cash) in this hypothetical policy, never loss=0 data.
 */
export function summarizeMorningGateHolding(rows){
  return NIGHT_HOLDING_HORIZONS.map(horizon=>{
    const eligible=(Array.isArray(rows)?rows:[]).filter(row=>
      ["BUY_CANDIDATE","CAUTION","SKIP"].includes(row.morningGate)&&
      holdingPnl100(row,"09:05",horizon)!==null);
    const days=new Set(eligible.map(row=>row.date)).size;
    const sufficient=eligible.length>=NIGHT_HOLDING_MIN_STOCK_DAYS&&
      days>=NIGHT_HOLDING_MIN_DAYS;
    const skip=eligible.filter(row=>row.morningGate!=="BUY_CANDIDATE");
    const lost=skip.map(row=>holdingPnl100(row,"09:05",horizon));
    const sum=values=>Number(values.reduce((a,b)=>a+b,0).toFixed(2));
    return {horizon,count:eligible.length,days,sufficient,skipCount:skip.length,
      buyCount:eligible.length-skip.length,
      avoidedLoss100:sufficient?sum(lost.filter(n=>n<0).map(n=>-n)):null,
      missedProfit100:sufficient?sum(lost.filter(n=>n>0)):null,
      gatedPnl100:sufficient?sum(eligible.filter(row=>
        row.morningGate==="BUY_CANDIDATE").map(row=>
        holdingPnl100(row,"09:05",horizon))):null,
      alwaysBuyPnl100:sufficient?sum(eligible.map(row=>
        holdingPnl100(row,"09:05",horizon))):null};
  });
}
