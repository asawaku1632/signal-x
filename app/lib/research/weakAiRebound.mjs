/** Weak AI reversal hypothesis, forward only.
 * This is NOT the position-dependent EXIT decision. AI POWER <55 is a
 * separately named research proxy with no user purchase price.
 * Sampling is deterministic and uses only prior-evening saved observations.
 */
import {jstParts} from "./entryTimeShadow.mjs";
import {evaluateExitTimeStudy} from "./exitTimingStudy.mjs";
export const WEAK_REBOUND_VERSION="WEAK_AI_LT55_RANDOMIZED_STRATA_5_V1";
export const WEAK_REBOUND_LIMIT=5;
export const WEAK_REBOUND_MIN_DAYS=20;
export const WEAK_REBOUND_MIN_STOCK_DAYS=60;
export const WEAK_REBOUND_HORIZONS=Object.freeze([1,3,5,10]);
const buckets=Object.freeze(["0–19","20–39","40–54"]);
const positive=n=>typeof n==="number"&&Number.isFinite(n)&&n>0;
const hash=s=>{let h=2166136261;for(const c of s){h^=c.charCodeAt(0);h=Math.imul(h,16777619);}return h>>>0;};
export const aiBucket=score=>Number.isFinite(Number(score))&&Number(score)>=0&&Number(score)<55?
 (Number(score)<20?buckets[0]:Number(score)<40?buckets[1]:buckets[2]):null;
export function chooseWeakCohort(rows,sourceDate){
  if(!/^20\d\d-\d\d-\d\d$/.test(sourceDate))throw Error("INVALID_SOURCE_DATE");
  if(!Array.isArray(rows)||rows.length<800||rows.length>1300)throw Error("INSUFFICIENT_DAILY_COVERAGE");
  const unique=new Map();
  for(const row of rows){
    const code=String(row?.code??"");
    const score=Number(row?.score),price=Number(row?.price);
    if(!/^[0-9]{4}$/.test(code)||!String(row?.name??"").trim()||
      !Number.isFinite(score)||score<0||score>100||
      !positive(price)||unique.has(code))continue;
    unique.set(code,{code,name:String(row.name),score,referencePrice:price,bucket:aiBucket(score)});
  }
  if(unique.size<800)throw Error("INSUFFICIENT_VALID_UNIVERSE");
  const weak=[...unique.values()].filter(x=>x.bucket!==null);
  if(weak.length<WEAK_REBOUND_LIMIT)return [];
  // Fixed quotas, then fill if any stratum is sparse. Ordering is stable and
  // pseudo-randomized by the date and code, NEVER subsequent price movement.
  const byBucket=new Map(buckets.map(b=>[b,weak.filter(x=>x.bucket===b)
    .sort((a,b)=>hash(sourceDate+":"+a.code)-hash(sourceDate+":"+b.code)||a.code.localeCompare(b.code))]));
  const used=new Set(),selected=[];
  for(const [i,quota] of [1,2,2].entries()){
    for(const stock of (byBucket.get(buckets[i])??[]).slice(0,quota)){
      if(!used.has(stock.code)){selected.push(stock);used.add(stock.code);}
    }
  }
  const remaining=weak.filter(x=>!used.has(x.code)).sort((a,b)=>
    hash(sourceDate+":"+a.code)-hash(sourceDate+":"+b.code)||a.code.localeCompare(b.code));
  for(const stock of remaining){
    if(selected.length>=WEAK_REBOUND_LIMIT)break;
    selected.push(stock);
  }
  return selected.slice(0,WEAK_REBOUND_LIMIT).map((stock,i)=>({...stock,rank:i+1}));
}
export function phaseGate(now,phase,isTradingDate){
  if(typeof isTradingDate!=="function")throw Error("CALENDAR_REQUIRED");
  const at=jstParts(now);
  if(!isTradingDate(at.date))return {ok:false,date:at.date,reason:"MARKET_CLOSED"};
  const windows={freeze:[18*60+25,19*60],entry:[16*60+55,17*60+20],
    outcomes:[17*60+35,18*60+10]};
  const range=windows[phase];
  if(!range)throw Error("INVALID_PHASE");
  return {ok:at.minute>=range[0]&&at.minute<range[1],date:at.date,
    reason:at.minute>=range[0]&&at.minute<range[1]?"OK":"OUTSIDE_WINDOW"};
}
/** Stock-to-close entry study is evaluated AFTER 15:30, not a live 9:08 alert.
 * 9:05 features are descriptive only; cannot be used for a hindsight BUY filter.
 * All 5min bars 09:10..15:25 must exist for drawdown measurement.
 */
export function evaluateWeakEntry(tradeDate,stock,bars){
  const missing=reason=>({code:stock.code,entryPrice:null,closePrice:null,
    sameDayReturn:null,maxAdversePct:null,maxFavorablePct:null,gapPct:null,
    open5MovePct:null,open5RangePct:null,status:"UNAVAILABLE",reason});
  const at=new Map();
  for(const bar of Array.isArray(bars)?bars:[]){
    if(!Number.isFinite(bar?.time))continue;
    const j=jstParts(bar.time*1000);
    if(j.date===tradeDate&&!at.has(j.hhmm))at.set(j.hhmm,bar);
  }
  const b0=at.get("09:00"),b5=at.get("09:05");
  if(!b0||!b5||![b0.open,b0.high,b0.low,b0.close,b5.open].every(positive)||
     b0.low>Math.min(b0.open,b0.close)||b0.high<Math.max(b0.open,b0.close)||
     b0.low>b0.high)return missing("MISSING_OPENING_BARS");
  const measured=evaluateExitTimeStudy(tradeDate,stock,bars);
  const close=measured.results?.find(x=>x.time==="15:30");
  if(!measured.complete||!positive(measured.entryPrice)||!close?.complete)
    return missing("MISSING_COMPLETE_DAY_BARS");
  const price=measured.entryPrice;
  // Flag extreme mismatch between overnight reference and entry price, which
  // may indicate split, stale source, or unusually large repricing.
  if(Math.abs(price/stock.referencePrice-1)>0.4)
    return missing("EXTREME_PRICE_GAP_REVIEW");
  const round=n=>Number(n.toFixed(4));
  return {code:stock.code,entryPrice:price,closePrice:close.exitPrice,
    sameDayReturn:close.returnPct,maxAdversePct:close.maxAdversePct,
    maxFavorablePct:close.maxFavorablePct,
    gapPct:round(100*(b5.open/stock.referencePrice-1)),
    open5MovePct:round(100*(b5.open/b0.open-1)),
    open5RangePct:round(100*(b0.high-b0.low)/b0.open),
    status:"COMPLETE",reason:null};
}
export function summarizeWeakOutcomes(rows){
  const periods=WEAK_REBOUND_HORIZONS.map(days=>{
    const field="return_"+days+"d";
    const valid=(Array.isArray(rows)?rows:[]).filter(r=>r.entry_price!==null&&
      r[field]!==null&&Number.isFinite(Number(r[field]))).map(r=>Number(r[field]));
    const n=valid.length,daysObserved=new Set((Array.isArray(rows)?rows:[])
      .filter(r=>r.entry_price!==null&&r[field]!==null&&Number.isFinite(Number(r[field])))
      .map(r=>String(r.entry_date))).size;
    const enough=n>=WEAK_REBOUND_MIN_STOCK_DAYS&&daysObserved>=WEAK_REBOUND_MIN_DAYS;
    const count=p=>valid.filter(p).length;
    return {days,checked:n,distinctDates:daysObserved,up:count(x=>x>0),
      plus3:count(x=>x>=3),minus3:count(x=>x<=-3),
      averagePct:enough?valid.reduce((a,b)=>a+b,0)/n:null,
      positiveRate:enough?100*count(x=>x>0)/n:null,
      reboundRate:enough?100*count(x=>x>=3)/n:null,
      worstPct:enough?Math.min(...valid):null};
  });
  return periods;
}
