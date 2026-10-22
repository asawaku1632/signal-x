/** Independent forward-only 09:05 shadow study.
 * Selection: saved prior-session AI, frozen the evening BEFORE target date.
 * Morning: 09:00 completed five-minute OHLC + 09:05 bar OPEN only.
 * Closing: never changes morning decisions; joins archived same-day close.
 * Prices are indicative, not executable orders. No model/alerts mutation.
 */
import {jstParts} from "./entryTimeShadow.mjs";
import {buildNightMorningCandidates} from "./nightMorningWatch.mjs";

export const MORNING_FINAL_POLICY="FROZEN_NIGHT_0905_CHECK_V1";
export const MIN_OBSERVED_DAYS=10;
export const MIN_MATCHED_STOCK_DAYS=30;
const positive=n=>typeof n==="number"&&Number.isFinite(n)&&n>0;
const safePct=(a,b)=>(a-b)/b*100;
const two=n=>Number(n.toFixed(3));
export const LABELS=Object.freeze({
  BUY_CANDIDATE:"買い候補（研究）",CAUTION:"注意（研究）",
  SKIP:"見送り（研究）",UNAVAILABLE:"価格確認待ち（データ不足）"
});

export function gatePhase(now,phase,isTradingDate) {
  if(typeof isTradingDate!=="function")throw Error("TRADING_CALENDAR_REQUIRED");
  const nowJst=jstParts(now);
  if(!isTradingDate(nowJst.date))return {ok:false,reason:"MARKET_CLOSED",date:nowJst.date};
  const windows={freeze:[18*60+10,19*60],morning:[9*60+8,9*60+19],
    closing:[17*60+5,18*60]};
  const window=windows[phase];
  if(!window)throw Error("INVALID_PHASE");
  if(nowJst.minute<window[0]||nowJst.minute>=window[1])
    return {ok:false,reason:"OUTSIDE_WINDOW",date:nowJst.date};
  return {ok:true,date:nowJst.date};
}

export function selectFrozenCohort(savedSignals){
  return buildNightMorningCandidates(savedSignals).map(({code,name,score,referencePrice,rank})=>
    ({code,name,score,referencePrice,rank}));
}

/** Yahoo 5min bars have a START timestamp. 09:05 close is NOT available at 09:08.
 * Only 09:05 OPEN may be read; never use 09:05 high/low/close/volume.
 * Lack of both candles is missing evidence, NOT "skip" or a win.
 */
export function decideAtNineOhFive(candidate,bars,tradeDate) {
  if(!/^\d{4}-\d{2}-\d{2}$/.test(tradeDate)||
    !candidate||!/^[0-9]{4}$/.test(String(candidate.code)))throw Error("INVALID_CANDIDATE");
  const map=new Map();
  for(const b of Array.isArray(bars)?bars:[]){
    if(!Number.isSafeInteger(b?.time)||b.time<=0)continue;
    const j=jstParts(b.time*1000);
    if(j.date===tradeDate&&(j.hhmm==="09:00"||j.hhmm==="09:05")&&!map.has(j.hhmm))map.set(j.hhmm,b);
  }
  const first=map.get("09:00"),second=map.get("09:05");
  const price=Number(candidate.referencePrice);
  if(!positive(price)||!first||!second||
    !positive(first.open)||!positive(first.high)||!positive(first.low)||
    !positive(first.close)||!positive(second.open)||
    !Number.isSafeInteger(first.time)||!Number.isSafeInteger(second.time)||
    second.time-first.time!==300||
    !Number.isFinite(first.volume)||first.volume<0||
    first.high<first.low||first.high<Math.max(first.open,first.close)||
    first.low>Math.min(first.open,first.close)||
    first.open>first.high||first.open<first.low||
    first.close>first.high||first.close<first.low) {
    return {code:String(candidate.code),name:String(candidate.name),rank:Number(candidate.rank),
      priorScore:Number(candidate.score),priorReferencePrice:price,
      label:"UNAVAILABLE",reasons:["当日9:00の確定足と9:05始値を検証できないため価格確認待ち（買い候補にしない）"],
      open0900:null,price0905:null,gapPct:null,movePct:null,rangePct:null,
      adversePct:null,volume0900:null};
  }
  const gap=safePct(second.open,price);
  const move=safePct(second.open,first.open);
  const range=safePct(first.high,first.low);
  const adverse=safePct(first.low,first.open);
  const reasons=[];
  let label="BUY_CANDIDATE";
  if(first.volume===0||gap>=5||gap<=-3||range>=4||adverse<=-3) {
    label="SKIP";
    if(first.volume===0)reasons.push("最初の5分間の売買量がゼロ");
    if(gap>=5)reasons.push("前日参考価格から5%以上の上昇");
    if(gap<=-3)reasons.push("前日参考価格から3%以上の下落");
    if(range>=4)reasons.push("最初の5分間の値幅4%以上");
    if(adverse<=-3)reasons.push("最初の5分間に3%以上の下落");
  }else if(gap>3||range>=2||adverse<=-1.5||move<=-1.5) {
    label="CAUTION";
    if(gap>3)reasons.push("前日参考価格から3%超の上昇");
    if(range>=2)reasons.push("最初の5分間の値幅2%以上");
    if(adverse<=-1.5)reasons.push("一時的な下落が1.5%以上");
    if(move<=-1.5)reasons.push("9:05価格が9:00始値より1.5%以上安い");
  }else{
    reasons.push("仮の価格変動ルールを通過（利益を保証しない）");
  }
  return {code:String(candidate.code),name:String(candidate.name),rank:Number(candidate.rank),
    priorScore:Number(candidate.score),priorReferencePrice:price,label,reasons,
    open0900:first.open,price0905:second.open,
    gapPct:two(gap),movePct:two(move),rangePct:two(range),
    adversePct:two(adverse),volume0900:first.volume};
}

/** Exact same frozen stock/date and prior night score/price must match the
 * existing independent 16:45 research archive. Exclude missing/inconsistent rows.
 */
export function compareClosingResults({tradeDate,cohort,morning,closingRun}){
  const archive=new Map();
  if(closingRun?.trade_date===tradeDate&&
    (closingRun.status==="COMPLETE"||closingRun.status==="PARTIAL")&&
    Array.isArray(closingRun.results)) {
    for(const row of closingRun.results){
      if(row?.date===tradeDate&&row.complete===true&&positive(row.closePrice)&&
        !archive.has(String(row.code)))archive.set(String(row.code),row);
    }
  }
  const byCode=new Map((Array.isArray(cohort)?cohort:[]).map(c=>[String(c.code),c]));
  return (Array.isArray(morning)?morning:[]).map(m=>{
    const c=byCode.get(String(m.code)),a=archive.get(String(m.code));
    const matched=!!c&&!!a&&Number(c.score)===Number(a.priorScore)&&
      Math.abs(Number(c.referencePrice)-Number(a.priorReferencePrice))<0.00001&&
      positive(m.price0905)&&m.label!=="UNAVAILABLE";
    if(!matched)return {code:String(m.code),label:String(m.label),complete:false,
      reason:"MISSING_OR_MISMATCHED_CLOSE"};
    const pnl100=Number(((a.closePrice-m.price0905)*100).toFixed(2));
    return {code:String(m.code),label:String(m.label),complete:true,
      observedEntry:Number(m.price0905),closePrice:Number(a.closePrice),
      pnl100,gatedPnl100:m.label==="BUY_CANDIDATE"?pnl100:0,
      avoidedLoss100:m.label!=="BUY_CANDIDATE"&&pnl100<0?-pnl100:0,
      missedProfit100:m.label!=="BUY_CANDIDATE"&&pnl100>0?pnl100:0};
  });
}

/** Never recompute or retroactively relabel stored decisions. */
export function summarizeForwardResearch(runs){
  const seen=new Set(),items=[];
  for(const run of Array.isArray(runs)?runs:[]){
    const date=String(run.trade_date??"");
    if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Array.isArray(run.closing_results))continue;
    for(const row of run.closing_results){
      if(!row?.complete||!positive(row.observedEntry)||!positive(row.closePrice)||
        !Number.isFinite(row.pnl100)||!["BUY_CANDIDATE","CAUTION","SKIP"].includes(row.label))continue;
      const key=date+":"+row.code;
      if(seen.has(key))continue;seen.add(key);items.push({...row,date});
    }
  }
  const days=new Set(items.map(x=>x.date)).size;
  const sufficient=days>=MIN_OBSERVED_DAYS&&items.length>=MIN_MATCHED_STOCK_DAYS;
  const group=label=>{
    const subset=items.filter(x=>x.label===label),n=subset.length;
    return {label,count:n,wins:subset.filter(x=>x.pnl100>0).length,
      avgPnl100:sufficient&&n?subset.reduce((s,x)=>s+x.pnl100,0)/n:null,
      positiveRate:sufficient&&n?100*subset.filter(x=>x.pnl100>0).length/n:null};
  };
  return {samples:items.length,days,sufficient,
    allPnl100:sufficient?items.reduce((s,x)=>s+x.pnl100,0):null,
    gatedPnl100:sufficient?items.reduce((s,x)=>s+x.gatedPnl100,0):null,
    avoidedLoss100:sufficient?items.reduce((s,x)=>s+x.avoidedLoss100,0):null,
    missedProfit100:sufficient?items.reduce((s,x)=>s+x.missedProfit100,0):null,
    labels:["BUY_CANDIDATE","CAUTION","SKIP"].map(group)};
}
