/** Descriptive prior-record holding-period evidence, never a forecast or buy/sell recommendation.
 * All three horizons require the SAME fully mature, complete stock-days.
 * No information from the target date or later may enter the calculation.
 */
export const HOLD_PERIOD_EVIDENCE_MIN_COUNT=30;
export const HOLD_PERIOD_EVIDENCE_MIN_DAYS=10;
export const HOLD_PERIODS=Object.freeze([1,3,5]);

const good=n=>typeof n==="number"&&Number.isFinite(n)&&n>0;
export function scoreGroup(score){
  const n=Number(score);
  if(!Number.isFinite(n)||n<85||n>100)return null;
  return n<90?"85–89":n<95?"90–94":"95–100";
}

/** Identical 09:05-entry cases and 1/3/5-day exit prices: no survivor advantage. */
export function historicPeriodEvidence(rows,asOfDate,score){
  const group=scoreGroup(score);
  if(!group||!/^20\d{2}-\d{2}-\d{2}$/.test(String(asOfDate)))return {group,count:0,days:0,ready:false,periods:[],leader:null};
  const seen=new Set(),eligible=[];
  for(const row of Array.isArray(rows)?rows:[]){
    if(typeof row?.date!=="string"||row.date>=asOfDate||
       scoreGroup(row.score)!==group||!/^\d{4}$/.test(String(row.code)))continue;
    const key=row.date+":"+row.code;
    if(seen.has(key))continue;
    if(!good(row.entries?.["09:05"])||!HOLD_PERIODS.every(h=>good(row.exits?.[h])))continue;
    seen.add(key);eligible.push(row);
  }
  const days=new Set(eligible.map(r=>r.date)).size;
  const ready=eligible.length>=HOLD_PERIOD_EVIDENCE_MIN_COUNT&&days>=HOLD_PERIOD_EVIDENCE_MIN_DAYS;
  const periods=HOLD_PERIODS.map(horizon=>{
    if(!ready)return {horizon,count:eligible.length,positiveRate:null,meanPct:null};
    const returns=eligible.map(r=>(r.exits[horizon]-r.entries["09:05"])/r.entries["09:05"]*100);
    return {horizon,count:returns.length,
      positiveRate:100*returns.filter(p=>p>0).length/returns.length,
      meanPct:returns.reduce((a,b)=>a+b,0)/returns.length};
  });
  // Do not turn small in-sample differences into "recommended day".
  // These are historic comparisons only; no chosen leader or predictive probability.
  return {group,count:eligible.length,days,ready,periods,leader:null};
}
