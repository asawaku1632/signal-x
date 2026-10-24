// Research-only adapter: caller supplies historical bars and already computed signals.
// No network, persistence, or production trading decisions.
import {groupEvents,fiveDayOutcome,nextOpenReturn,adjustmentStatus} from "./dualSurgeEvaluation.mjs";
export const LEDGER_VERSION="DUAL_SURGE_LEDGER_V1";
const horizons=[1,3,5,10];
export function buildDualSurgeLedger({code,rows,signals}){
 if(typeof code!=="string"||!Array.isArray(rows)||!Array.isArray(signals))throw Error("INVALID_INPUT");
 const dates=rows.map(x=>x.date);
 if(new Set(dates).size!==dates.length||dates.some((d,i)=>typeof d!=="string"||(i>0&&d<=dates[i-1])))throw Error("INVALID_SESSIONS");
 const bars=rows.map(r=>({open:r.open,close:r.close,adjFactor:r.adjFactor}));
 const events=groupEvents(signals,dates);
 return events.map(e=>{
  const outcomes=Object.fromEntries(horizons.map(h=>[h,{
   legacyCloseToClose:fiveDayOutcome(bars,e.firstIndex,h),
   nextOpenToFutureClose:nextOpenReturn(bars,e.firstIndex,h)
  }]));
  return {code,cohort:e.cohort,startDate:e.startDate,endDate:e.endDate,signalDays:e.signalDays,
   ledgerVersion:LEDGER_VERSION,signalSessionIndex:e.firstIndex,
   signalAdjustmentStatus:adjustmentStatus(bars[e.firstIndex].adjFactor),outcomes};
 });
}
export function summarizeLedger(ledger,{horizon=5,metric="nextOpenToFutureClose"}={}){
 if(!horizons.includes(horizon)||!["legacyCloseToClose","nextOpenToFutureClose"].includes(metric))throw Error("INVALID_SUMMARY");
 const groups=[...new Set(ledger.map(x=>x.cohort))];
 return groups.map(cohort=>{
  const events=ledger.filter(e=>e.cohort===cohort);
  const outcomes=events.map(e=>e.outcomes[horizon][metric]);
  const matured=outcomes.filter(o=>o.status==="MATURED");
  const returns=matured.map(o=>o.returnPct);
  return {cohort,horizon,metric,events:events.length,matured:matured.length,
   pending:outcomes.filter(o=>o.status==="PENDING").length,
   excluded:outcomes.filter(o=>o.status.startsWith("EXCLUDED")).length,
   positive:returns.filter(x=>x>0).length,
   gain5:returns.filter(x=>x>=5).length,gain10:returns.filter(x=>x>=10).length,
   loss5:returns.filter(x=>x<=-5).length,
   averageReturnPct:returns.length?Number((returns.reduce((a,b)=>a+b,0)/returns.length).toFixed(3)):null,
   insufficientSample:matured.length<30};
 });
}
