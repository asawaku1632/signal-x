/** Pure, read-only research pipeline health. Observations are archived
 * separately; absence is unknown until a grace period after Cron.
 * No server/network calls, no existing learning/notification/trade mutations.
 */
export const RECHECK_HEALTH_START_DATE="2026-10-15";
export const RECHECK_HEALTH_SCHEDULE=Object.freeze({
  recheck:"10:34",close:"16:45",recheckGrace:"10:50",closeGrace:"17:05"
});
export function jstStudyClock(date){
  const d=new Date(date);
  if(!Number.isFinite(d.getTime()))throw Error("INVALID_RESEARCH_CLOCK");
  const parts=new Intl.DateTimeFormat("en-GB",{
    timeZone:"Asia/Tokyo",year:"numeric",month:"2-digit",day:"2-digit",
    hour:"2-digit",minute:"2-digit",hourCycle:"h23",
  }).formatToParts(d);
  const p=(key)=>parts.find(x=>x.type===key)?.value??"";
  return {date:p("year")+"-"+p("month")+"-"+p("day"),
    minute:Number(p("hour"))*60+Number(p("minute"))};
}
/** @param {{
 * now:Date, tradingDay:boolean, tradeDate:string,
 * hasObservationReadError?:boolean, hasResultReadError?:boolean,
 * expectedCohort?:number, recheckCount?:number, matchedCount?:number,
 * closeRun?:{status:string,results?:Array<{complete:boolean}>}|null
 * }} params
 */
export function evaluateRecheckResearchHealth({
  now,tradingDay,tradeDate,hasObservationReadError=false,hasResultReadError=false,
  expectedCohort=5,recheckCount=0,closeRun=null,matchedCount=0
}){
  const t=jstStudyClock(now);
  if(t.date!==tradeDate)throw Error("WRONG_RESEARCH_DATE");
  const base={date:tradeDate,expectedCohort,recheckCount,matchedCount,closingValidCount:0,
    scheduled:RECHECK_HEALTH_SCHEDULE};
  if(tradeDate<RECHECK_HEALTH_START_DATE)
    return {...base,overall:"NOT_STARTED",recheck:"NOT_STARTED",close:"NOT_STARTED",comparison:"NOT_STARTED"};
  if(!tradingDay)
    return {...base,overall:"MARKET_CLOSED",recheck:"MARKET_CLOSED",close:"MARKET_CLOSED",comparison:"MARKET_CLOSED"};
  const hasEnough=(count)=>count>=expectedCohort&&expectedCohort>0;
  const count=Math.max(0,Number(recheckCount)||0);
  const recheck=hasObservationReadError?"READ_ERROR":hasEnough(count)?"RECORDED":
    count>0?"PARTIAL":t.minute>=10*60+50?"MISSING":"PENDING";
  const complete=closeRun && Array.isArray(closeRun.results)?
    closeRun.results.filter(row=>row?.complete===true).length:0;
  const close=hasResultReadError?"READ_ERROR":closeRun?.status==="FAILED"?"FAILED":
    closeRun?.status==="CLAIMED"?"PROCESSING":
    closeRun && hasEnough(complete)?"RECORDED":
    closeRun?"PARTIAL":t.minute>=17*60+5?"MISSING":"PENDING";
  const comparison=hasResultReadError||hasObservationReadError?"READ_ERROR":
    matchedCount>0?"RECORDED":
    close==="RECORDED"||close==="PARTIAL"?"MISSING_VALID_PAIRS":"PENDING";
  const incomplete=["MISSING","FAILED","READ_ERROR","MISSING_VALID_PAIRS"];
  const overall=incomplete.some(x=>[recheck,close,comparison].includes(x))?"CHECK_REQUIRED":
    recheck==="RECORDED"&&close==="RECORDED"&&comparison==="RECORDED"?"RECORDED":
    recheck==="PARTIAL"||close==="PARTIAL"?"PARTIAL":"PENDING";
  return {...base,overall,recheck,close,comparison,
    closingValidCount:complete};
}
