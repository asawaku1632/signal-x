/**
 * Owner-only historical outcome audit for a PRE-FROZEN top-five cohort.
 * Input: buildNightHoldingStudy() rows, which require an actual night freeze,
 * identical prior score/price, saved 09:05 morning decision and timestamped
 * after-close prices. The morning decision is saved around 09:08; never
 * pretend that a later decision could buy at the earlier 09:05 bar OPEN.
 * Use 09:30 OPEN only, the earliest universally post-decision slot archived
 * by the existing independent study. No actual executable bid/ask proof.
 * Do not retrospectively create a cohort from winners.
 */
export const NEXT_SESSION_FORWARD_POLICY="FROZEN_0905_DECISION_0930_ENTRY_BUDGET_1_3_5_V2";
export const NEXT_SESSION_FORWARD_HORIZONS=Object.freeze([1,3,5]);
export const MIN_FORWARD_STOCK_DAYS=30;
export const MIN_FORWARD_TRADE_DAYS=10;
const valid=n=>typeof n==="number"&&Number.isFinite(n)&&n>0;
const validDay=x=>typeof x==="string"&&/^\d{4}-\d{2}-\d{2}$/.test(x)&&
  Number.isFinite(Date.parse(x+"T00:00:00Z"))&&
  new Date(x+"T00:00:00Z").toISOString().slice(0,10)===x;
const average=arr=>arr.reduce((s,x)=>s+x,0)/arr.length;
const median=arr=>{const s=[...arr].sort((a,b)=>a-b),n=s.length;
  return n%2?s[(n-1)/2]:(s[n/2-1]+s[n/2])/2;};

/** Match price and budget AT 09:05 as well as at the prior-night freeze.
 * The 09:05 decision precedes the hypothetical 09:30 entry. Do not count
 * CAUTION/SKIP as trades or zero-return observations.
 * Missing outcomes are omitted from performance denominators, not "losses".
 * Insufficient sample metrics remain null, while sample coverage is shown.
 */
export function summarizeFrozenBudgetOutcomes(rows,{
  budgetYen, asOfDate, targetProfitYen=7000, lossThresholdYen=10000,
}){
  if(![100000,300000,350000,500000].includes(budgetYen)||
     !validDay(asOfDate)||!Number.isInteger(targetProfitYen)||targetProfitYen<=0||
     !Number.isInteger(lossThresholdYen)||lossThresholdYen<=0)
    throw Error("INVALID_FORWARD_POLICY");
  const seen=new Set();
  let frozenEligible=0, overBudget=0, gateRejected=0, noMorning=0;
  const eligible=[];
  for(const row of Array.isArray(rows)?rows:[]){
    if(!row||!validDay(row.date)||row.date>=asOfDate||
       !/^[0-9]{4}$/.test(String(row.code)))continue;
    const key=row.date+":"+row.code;
    if(seen.has(key))continue;
    seen.add(key);
    const freeze=Date.parse(String(row.freezeAt??""));
    const end=Date.parse(row.date+"T09:00:00+09:00");
    if(!Number.isFinite(freeze)||freeze>=end||
       !valid(row.entries?.PREVIOUS_REFERENCE)||
       row.entries.PREVIOUS_REFERENCE*100>budgetYen)continue;
    frozenEligible++;
    if(!valid(row.entries?.["09:30"])||
       !["BUY_CANDIDATE","CAUTION","SKIP"].includes(row.morningGate)){
      noMorning++;continue;
    }
    if(row.entries["09:30"]*100>budgetYen){overBudget++;continue;}
    if(row.morningGate!=="BUY_CANDIDATE"){gateRejected++;continue;}
    eligible.push(row);
  }
  const horizons=NEXT_SESSION_FORWARD_HORIZONS.map(horizon=>{
    const mature=eligible.filter(r=>validDay(r.targetDates?.[horizon])&&
      r.targetDates[horizon]<asOfDate);
    const completed=mature.filter(r=>valid(r.exits?.[horizon]));
    const days=new Set(completed.map(r=>r.date)).size;
    const pnls=completed.map(r=>Number(((r.exits[horizon]-r.entries["09:30"])*100).toFixed(2)));
    const sufficient=pnls.length>=MIN_FORWARD_STOCK_DAYS&&days>=MIN_FORWARD_TRADE_DAYS;
    return {horizon,eligible:eligible.length,matured:mature.length,
      checked:pnls.length,missing:mature.length-pnls.length,days,sufficient,
      wins:pnls.filter(x=>x>0).length,
      targetHits:pnls.filter(x=>x>=targetProfitYen).length,
      lossThresholdBreaches:pnls.filter(x=>x<=-lossThresholdYen).length,
      avgPnl100:sufficient?Number(average(pnls).toFixed(2)):null,
      medianPnl100:sufficient?Number(median(pnls).toFixed(2)):null,
      positiveRate:sufficient?Number((100*pnls.filter(x=>x>0).length/pnls.length).toFixed(2)):null,
      targetHitRate:sufficient?Number((100*pnls.filter(x=>x>=targetProfitYen).length/pnls.length).toFixed(2)):null,
    };
  });
  return {policy:NEXT_SESSION_FORWARD_POLICY,budgetYen,asOfDate,
    frozenEligible,overBudget,gateRejected,noMorning,eligible:eligible.length,horizons,
    status:horizons.every(h=>h.sufficient)?"HISTORICAL_SAMPLE_READY":"INSUFFICIENT_HISTORY"};
}
