// Shadow-only Newey-West-style descriptive uncertainty on ordered trading-day means.
// Calendar gaps are not filled. The caller must supply genuinely consecutive observed sessions.
import {compareMarketBreadthPairedBaseline} from './marketBreadthPairedBaselineComparison.mjs';
export function assessMarketBreadthSerialDependence({pairs=[],lags=4,minDates=20}={}){
 if(!Number.isSafeInteger(lags)||lags<0||lags>50)throw new TypeError('INVALID_SERIAL_LAGS');
 const base=compareMarketBreadthPairedBaseline({pairs,minPairs:1,minDates:1});
 const rejected=new Set(base.rejected.map(x=>x.index)),groups=new Map();
 for(let i=0;i<pairs.length;i++){if(rejected.has(i))continue;const x=pairs[i],g=groups.get(x.tradeDate)??[];g.push(x.researchReturnPercent-x.baselineReturnPercent);groups.set(x.tradeDate,g)}
 const dates=[...groups.keys()].sort(),values=dates.map(d=>{const a=groups.get(d);return a.reduce((x,y)=>x+y,0)/a.length});
 const n=values.length,mean=n?values.reduce((a,b)=>a+b,0)/n:null;
 if(n<2)return {researchOnly:true,productionEligible:false,notificationEligible:false,aiPromotionAuthorized:false,observedDates:n,meanDailyDelta:mean,hacStandardError:null,approximate95PercentInterval:null,reason:'INSUFFICIENT_DATES'};
 const residual=values.map(v=>v-mean),effectiveLags=Math.min(lags,n-1);
 let longRunVariance=residual.reduce((a,v)=>a+v*v,0)/n;
 for(let k=1;k<=effectiveLags;k++){let cov=0;for(let t=k;t<n;t++)cov+=residual[t]*residual[t-k];longRunVariance+=2*(1-k/(effectiveLags+1))*cov/n}
 const se=Math.sqrt(Math.max(0,longRunVariance)/n);
 return {researchOnly:true,productionEligible:false,notificationEligible:false,aiPromotionAuthorized:false,observedDates:n,meanDailyDelta:mean,requestedLags:lags,effectiveLags,
  hacStandardError:se,approximate95PercentInterval:{lower:mean-1.96*se,upper:mean+1.96*se,method:'BARTLETT_HAC_NORMAL_APPROXIMATION'},
  sampleReady:n>=minDates,independentImprovementVerified:false,
  limitations:['OBSERVED_DATES_MUST_BE_CONSECUTIVE_EXCHANGE_SESSIONS','OVERLAPPING_FIVE_SESSION_RETURNS','LAG_SELECTION_SENSITIVITY','NO_MULTIPLE_TESTING_CORRECTION','EXTERNAL_EVIDENCE_NOT_AUDITED']};
}
