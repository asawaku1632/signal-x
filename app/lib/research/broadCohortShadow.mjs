/** Phase B / read-only 30-stock longitudinal market-scan research.
 * Identical frozen prior-day picks in seven already-scheduled slots.
 * This study is NOT a 5-minute execution backtest and never requests quotes.
 */
export const BROAD_SHADOW_VERSION="PRIOR_TOP30_CACHED_SCAN_7SLOTS_V1";
export const BROAD_SHADOW_MAX_CODES=30;
export const BROAD_SHADOW_MAX_QUOTE_AGE_MS=25*60*1000;
export const BROAD_SHADOW_SLOTS=Object.freeze(["09:15","09:30","10:30","12:40","13:00","14:30","15:15"]);
const dateRx=/^\d{4}-\d{2}-\d{2}$/;
function numberOrNull(v){
  if(v===null||v===undefined||v==="")return null;
  const n=Number(v);return Number.isFinite(n)?n:null;
}
const isoDayJst=(ms)=>new Intl.DateTimeFormat("en-CA",{
  timeZone:"Asia/Tokyo",year:"numeric",month:"2-digit",day:"2-digit"
}).format(new Date(ms));

export function freezeBroadCandidates(rows){
  const valid=[];
  const seen=new Set();
  for(const r of rows??[]){
    const code=String(r?.code??"");
    const score=numberOrNull(r?.score);
    const price=numberOrNull(r?.price);
    if(!/^[0-9]{4}$/.test(code)||score===null||score<85||score>100||
      price===null||price<=0||seen.has(code))continue;
    seen.add(code);
    valid.push({code,name:String(r.name??""),priorScore:score,priorPrice:price});
  }
  return valid.sort((a,b)=>b.priorScore-a.priorScore||a.code.localeCompare(b.code))
    .slice(0,BROAD_SHADOW_MAX_CODES).map((row,i)=>({...row,priorRank:i+1}));
}
/** @returns {{expected:number,valid:Array,missing:Array,priorDate:string,tradeDate:string,timeSlot:string}}
 * Failed validation yields a missing reason; never use stale or synthetic quotes.
 */
export function captureBroadCohort({cohort,stocks,tradeDate,priorDate,timeSlot,snapshotSavedAt,now}){
  if(!dateRx.test(tradeDate)||!dateRx.test(priorDate)||priorDate>=tradeDate||
    !BROAD_SHADOW_SLOTS.includes(timeSlot)||!Array.isArray(stocks))
    throw Error("INVALID_BROAD_RESEARCH_CONTEXT");
  const nowMs=new Date(now).getTime();
  const savedMs=new Date(snapshotSavedAt).getTime();
  if(!Number.isFinite(nowMs)||!Number.isFinite(savedMs)||
     isoDayJst(savedMs)!==tradeDate||savedMs>nowMs+10_000||nowMs-savedMs>6*60*1000)
    throw Error("STALE_OR_INVALID_SNAPSHOT");
  const selected=freezeBroadCandidates(cohort);
  const map=new Map(stocks.map(s=>[String(s?.code??""),s]));
  const valid=[],missing=[];
  for(const c of selected){
    const s=map.get(c.code);
    let reason=null;
    const price=numberOrNull(s?.price??s?.currentPrice);
    const score=numberOrNull(s?.score??s?.aiPower);
    const epoch=numberOrNull(s?.latestBarTimestamp);
    const barMs=epoch===null?NaN:epoch*1000;
    if(!s)reason="NOT_IN_CACHED_SCAN";
    else if(price===null||price<=0)reason="INVALID_PRICE";
    else if(score===null||score<0||score>100)reason="INVALID_AI_POWER";
    else if(!Number.isInteger(epoch)||epoch<1_500_000_000||epoch>2_100_000_000)
      reason="QUOTE_TIME_UNKNOWN";
    else if(isoDayJst(barMs)!==tradeDate||barMs>savedMs+120_000||
      barMs>nowMs+120_000||nowMs-barMs>BROAD_SHADOW_MAX_QUOTE_AGE_MS)
      reason="QUOTE_OLD_OR_WRONG_DAY";
    if(reason){missing.push({code:c.code,priorRank:c.priorRank,reason});continue;}
    valid.push({...c,timeSlot,score,price,quoteTime:new Date(barMs).toISOString()});
  }
  return {tradeDate,priorDate,timeSlot,policy:BROAD_SHADOW_VERSION,
    expected:selected.length,valid,missing};
}
export function summarizeBroadCoverage(rows){
  const slots=BROAD_SHADOW_SLOTS.map(slot=>{
    const subset=(rows??[]).filter(row=>row.time_slot===slot);
    const expected=subset.reduce((a,r)=>a+Number(r.expected_count??0),0);
    const observed=subset.reduce((a,r)=>a+Number(r.observed_count??0),0);
    return {slot,days:subset.length,expected,observed,
      rate:expected>0?100*observed/expected:null};
  });
  const daySet=new Set((rows??[]).map(r=>r.trade_date));
  return {days:daySet.size,slots};
}
