import { parseJQuantsTseCalendar } from './jquantsVerifiedCalendar.mjs';
import { compareMmOutcomeShadow } from './mmOutcomeShadowComparison.mjs';
import { summarizeMmOutcomeShadow } from './mmOutcomeShadowSummary.mjs';

export function runMmShadowAudit({calendarRows,calendarFrom,calendarTo,sourceVerified=false,responseComplete=false,observations,stockClosesByCode,indexCloses=new Map(),asOfDate,tolerancePct=0.01}={}) {
  const blocked=reason=>({status:'BLOCKED',reason,rows:[],summary:null,notificationEligible:false});
  if(!Array.isArray(observations)||!(stockClosesByCode instanceof Map)||!(indexCloses instanceof Map))return blocked('INVALID_INPUT');
  if(observations.some(o=>!o||typeof o.code!=='string'||!o.code.trim()||typeof o.tradeDate!=='string'))return blocked('INVALID_OBSERVATION');
  if(typeof asOfDate!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(asOfDate)||Number.isNaN(Date.parse(asOfDate+'T00:00:00Z'))||new Date(asOfDate+'T00:00:00Z').toISOString().slice(0,10)!==asOfDate||asOfDate<=calendarFrom)return blocked('AS_OF_OUTSIDE_CALENDAR');
  if(observations.some(o=>o.tradeDate<calendarFrom||o.tradeDate>calendarTo))return blocked('OBSERVATION_OUTSIDE_CALENDAR');
  const calendar=parseJQuantsTseCalendar({data:calendarRows,from:calendarFrom,to:calendarTo,sourceVerified,responseComplete});
  if(calendar.status!=='RESEARCH_ONLY')return blocked(calendar.reason);
  if(observations.some(o=>!calendar.exchangeSessions.includes(o.tradeDate)))return blocked('OBSERVATION_NOT_TSE_SESSION');
  const report=compareMmOutcomeShadow({observations,exchangeSessions:calendar.exchangeSessions,calendarVerified:true,calendarComplete:true,stockClosesByCode,indexCloses,asOfDate});
  if(report.status!=='RESEARCH_ONLY')return blocked(report.reason);
  const summary=summarizeMmOutcomeShadow(report,{tolerancePct});
  if(summary.status!=='RESEARCH_ONLY')return blocked(summary.reason);
  return {status:'RESEARCH_ONLY',calendarSource:calendar.source,sessionCount:calendar.exchangeSessions.length,rows:report.rows,summary,notificationEligible:false,historicalDataModified:false};
}
