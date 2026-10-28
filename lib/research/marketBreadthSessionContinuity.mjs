// Shadow-only session continuity audit; never infer exchange holidays from weekdays.
import {assessMarketBreadthSerialDependence} from './marketBreadthSerialDependence.mjs';
const validDay=s=>typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&!Number.isNaN(Date.parse(s+'T00:00:00Z'))&&new Date(s+'T00:00:00Z').toISOString().slice(0,10)===s;
export function assessMarketBreadthSessionContinuity({pairs=[],verifiedSessions=[],lags=4,minDates=20}={}){
 if(!Array.isArray(verifiedSessions)||verifiedSessions.length===0||verifiedSessions.some(x=>!validDay(x))||new Set(verifiedSessions).size!==verifiedSessions.length||verifiedSessions.some((x,i)=>i>0&&verifiedSessions[i-1]>=x))throw new TypeError('VERIFIED_EXCHANGE_SESSIONS_REQUIRED');
 const base=assessMarketBreadthSerialDependence({pairs,lags,minDates});
 const dates=[...new Set(pairs.filter(x=>x&&typeof x.tradeDate==='string').map(x=>x.tradeDate))].sort();
 const missingCalendarDates=dates.filter(d=>!verifiedSessions.includes(d));
 const indexes=dates.map(d=>verifiedSessions.indexOf(d)).filter(i=>i>=0);
 const gaps=[];
 for(let i=1;i<indexes.length;i++)if(indexes[i]!==indexes[i-1]+1)gaps.push({previousObservedDate:dates[i-1],nextObservedDate:dates[i],missingSessionCount:indexes[i]-indexes[i-1]-1});
 const complete=missingCalendarDates.length===0&&gaps.length===0&&base.observedDates===dates.length;
 return {researchOnly:true,productionEligible:false,notificationEligible:false,aiPromotionAuthorized:false,verifiedCalendarProvided:true,consecutiveObservedSessions:complete,missingCalendarDates,gaps,
  serialEstimateUsableForDescriptiveReview:complete&&base.sampleReady,serialEstimate:complete?base:null,
  missing:complete?['INDEPENDENT_CALENDAR_AUTHORITY','EXTERNAL_OUTCOME_AUDIT']:['OBSERVATION_SESSION_GAPS_OR_INVALID_ROWS','INDEPENDENT_CALENDAR_AUTHORITY','EXTERNAL_OUTCOME_AUDIT']};
}
