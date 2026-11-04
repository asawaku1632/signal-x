/**
 * Retrospective opportunity-level comparison, frozen at every SMA75 breakout.
 * Waiting for a retest entails a 0% cash return if no retest occurs in 10 sessions.
 * All breakouts must have the full 15-session opportunity window for inclusion.
 * Different holding lengths and risk exposures: descriptive, not randomized/causal.
 */
export const MA75_WAIT_POLICY_VERSION='ma75_wait_policy_v1';
const mean=xs=>xs.reduce((sum,x)=>sum+x,0)/xs.length;
const round=x=>Number(x.toFixed(3));
const finite=x=>typeof x==='number'&&Number.isFinite(x);
export function auditMa75WaitPolicy(study,cohorts){
 if(!Array.isArray(study?.observations)||!Array.isArray(cohorts))
  throw new TypeError('Expected study observations and frozen cohorts');
 const histories=new Map();
 for(const c of cohorts){
   if(histories.has(c.code))throw new TypeError('Duplicate code in cohort');
   histories.set(c.code,Array.isArray(c.candles)?c.candles:null);
 }
 const retest=new Map(study.observations.filter(x=>x.kind==='RETEST')
   .map(x=>[x.code+':'+x.breakoutIndex,x]));
 const opportunities=[];
 let immature=0,quarantined=0;
 for(const b of study.observations.filter(x=>x.kind==='BREAKOUT')){
   const bars=histories.get(b.code);
   if(!Array.isArray(bars)||b.signalIndex+15>=bars.length){immature++;continue;}
   let gap=false;
   for(let k=b.signalIndex+1;k<=b.signalIndex+15;k++){
     if(bars[k-1].close<=0||Math.abs(bars[k].close/bars[k-1].close-1)>0.45){gap=true;break;}
   }
   if(gap){quarantined++;continue;}
   const later=retest.get(b.code+':'+b.signalIndex)??null;
   if(!finite(b.return5Percent) || (later&&!finite(later.return5Percent))){quarantined++;continue;}
   opportunities.push({code:b.code,breakoutIndex:b.signalIndex,
     breakoutReturn5Percent:b.return5Percent,
     waitReturn5Percent:later?later.return5Percent:0,
     waitTraded:Boolean(later),
     breakoutBudgetEligible:b.budgetEligible,
     retestBudgetEligible:later?later.budgetEligible:false});
 }
 const baseline=opportunities.map(x=>x.breakoutReturn5Percent);
 const wait=opportunities.map(x=>x.waitReturn5Percent);
 return {
   version:MA75_WAIT_POLICY_VERSION,completeOpportunities:opportunities.length,
   immature,quarantined,distinctCodes:new Set(opportunities.map(x=>x.code)).size,
   waitedAndTraded:opportunities.filter(x=>x.waitTraded).length,
   waitedInCash:opportunities.filter(x=>!x.waitTraded).length,
   breakoutAveragePercent:baseline.length?round(mean(baseline)):null,
   waitAveragePercent:wait.length?round(mean(wait)):null,
   waitMinusBreakoutPercent:wait.length?round(mean(opportunities.map(x=>x.waitReturn5Percent-x.breakoutReturn5Percent))):null,
   breakoutPositivePercent:baseline.length?round(100*baseline.filter(x=>x>0).length/baseline.length):null,
   waitPositivePercent:wait.length?round(100*wait.filter(x=>x>0).length/wait.length):null,
   opportunities,
   eligibleForProduction:false,
   caveats:[
     'Only matured fifteen-session opportunities are included; never treat immature ones as cash trades.',
     'Waiting in cash returns zero; opportunity costs and other reallocation are not modelled.',
     'Strategies have unequal exposure, holding periods and correlated overlapping stock events.',
     'Historical watched-chart sample has selection bias and is not prospective evidence.',
   ],
 };
}
