/**
 * SHADOW ONLY: predeclared MA75 research-release review gate.
 * No dynamic thresholds chosen from study outcomes. Even technically complete
 * synthetic/self-reported inputs MUST NOT enable scoring or notifications.
 */
import {verifyMa75ForwardManifest} from './ma75ForwardProtocol.mjs';

export const MA75_REVIEW_GATE_VERSION='ma75_independent_review_gate_v1';
export const MA75_MIN_REVIEW_COUNTS=Object.freeze({
  breakout5dComplete:100, wait15dComplete:100, distinctStockCodes:40,
  distinctSignalDates:30, distinctCalendarMonths:3,
  atLeastCashOpportunities:10, atLeastTradedRetests:10,
});
const key=o=>String(o?.code??'?')+':'+String(o?.signalDate??'?');
const isDate=x=>typeof x==='string'&&/^20\d\d-\d\d-\d\d$/.test(x)&&
 Number.isFinite(Date.parse(x+'T00:00:00Z'))&&
 new Date(x+'T00:00:00Z').toISOString().slice(0,10)===x;

/**
 * Report whether a frozen forward cohort is structurally ready for a HUMAN
 * review. It is NOT a proof of an investing edge, and cannot switch on live
 * recommendations. Every production privilege requires independently
 * authenticated capture, provider rights, corporate actions, calendar and
 * risk/transaction-cost evaluation outside this pure function.
 */
export function auditMa75ResearchReviewGate(manifest,{
  universeCoverage,forwardSummary,waitPolicy,revisionAudit,
}={}){
 if(!verifyMa75ForwardManifest(manifest))throw new TypeError('Invalid frozen manifest');
 const blockers=[];
 const block=(cond,code)=>{if(!cond)blockers.push(code)};
 const hash=manifest.manifestSha256;

 const coverageOK=universeCoverage?.version==='ma75_universe_coverage_v1'&&
   universeCoverage.manifestSha256===hash&&universeCoverage.integrityPass===true&&
   universeCoverage.coveragePercent===100&&universeCoverage.unavailableCodeDates===0&&
   Number.isInteger(universeCoverage.expectedCodeDates)&&
   universeCoverage.expectedCodeDates>0;
 block(coverageOK,'INCOMPLETE_FROZEN_UNIVERSE');

 const summaryOK=forwardSummary?.version==='ma75_forward_summary_v1'&&
   forwardSummary.manifestSha256===hash&&forwardSummary.integrityPass===true&&
   forwardSummary.structuralCoveragePass===true&&
   forwardSummary.independentlyAuthenticatedCoverage===false&&
   forwardSummary.eligibleForProduction===false;
 block(summaryOK,'INCOMPLETE_BREAKOUT_SUMMARY');
 const completedBreakouts=Number.isInteger(forwardSummary?.totals?.completed)
   ?forwardSummary.totals.completed:0;
 block(completedBreakouts>=MA75_MIN_REVIEW_COUNTS.breakout5dComplete,
   'INSUFFICIENT_FIVE_SESSION_RESULTS');

 const rows=waitPolicy?.observations;
 const waitOK=waitPolicy?.version==='ma75_forward_wait_policy_v1'&&
   waitPolicy.manifestSha256===hash&&Array.isArray(rows)&&
   waitPolicy.eligibleForProduction===false&&waitPolicy.validatedForwardWinRate===null&&
   Number.isInteger(waitPolicy.complete)&&Number.isInteger(waitPolicy.pending)&&
   Number.isInteger(waitPolicy.quarantined)&&
   waitPolicy.complete+waitPolicy.pending+waitPolicy.quarantined===rows?.length;
 block(waitOK,'INVALID_WAIT_POLICY_AUDIT');
 const completed=Array.isArray(rows)?rows.filter(r=>r?.status==='COMPLETED_HYPOTHETICAL'):[];
 const keys=new Set(completed.map(x=>x.id));
 const exact=completed.every(x=>x.detail&&x.detail.id===x.id&&
   isDate(x.detail.signalDate)&&
   x.detail.signalDate>=manifest.firstSignalDate&&
   manifest.codes.includes(x.detail.code)&&
   key(x.detail)===x.id&&
   typeof x.detail.waitTraded==='boolean'&&
   typeof x.detail.waitCash==='boolean'&&
   x.detail.waitTraded!==x.detail.waitCash&&
   typeof x.detail.breakoutReturn5Percent==='number'&&
   Number.isFinite(x.detail.breakoutReturn5Percent)&&
   typeof x.detail.waitReturn5Percent==='number'&&
   Number.isFinite(x.detail.waitReturn5Percent)&&
   (x.detail.waitCash!==true||x.detail.waitReturn5Percent===0));
 block(waitOK&&completed.length===waitPolicy.complete&&keys.size===completed.length&&exact,
   'UNVERIFIED_WAIT_POLICY_DENOMINATOR');
 block(completed.length>=MA75_MIN_REVIEW_COUNTS.wait15dComplete,
   'INSUFFICIENT_FIFTEEN_SESSION_RESULTS');
 const codes=new Set(completed.map(x=>x.detail?.code).filter(Boolean));
 const days=new Set(completed.map(x=>x.detail?.signalDate).filter(isDate));
 const months=new Set([...days].map(d=>d.slice(0,7)));
 const cash=completed.filter(x=>x.detail?.waitCash===true).length;
 const traded=completed.filter(x=>x.detail?.waitTraded===true).length;
 block(codes.size>=MA75_MIN_REVIEW_COUNTS.distinctStockCodes,
   'INSUFFICIENT_DISTINCT_STOCKS');
 block(days.size>=MA75_MIN_REVIEW_COUNTS.distinctSignalDates,
   'INSUFFICIENT_DISTINCT_SIGNAL_DATES');
 block(months.size>=MA75_MIN_REVIEW_COUNTS.distinctCalendarMonths,
   'INSUFFICIENT_DISTINCT_CALENDAR_MONTHS');
 block(cash>=MA75_MIN_REVIEW_COUNTS.atLeastCashOpportunities&&
   traded>=MA75_MIN_REVIEW_COUNTS.atLeastTradedRetests,
   'INSUFFICIENT_WAIT_CASH_COMPARISON');
 const revisionOK=revisionAudit?.version==='ma75_settlement_revision_audit_v1'&&
   revisionAudit.manifestSha256===hash&&revisionAudit.validTransition===true;
 block(revisionOK,'REVISION_INTEGRITY_NOT_VERIFIED');
 const technicalPrecheckPass=blockers.length===0;
 return {
   version:MA75_REVIEW_GATE_VERSION,manifestSha256:hash,
   technicalPrecheckPass,
   eligibleForHumanIndependentReview:technicalPrecheckPass,
   blockers,
   counts:{completedBreakouts,completedWaitOpportunities:completed.length,
     distinctStockCodes:codes.size,distinctSignalDates:days.size,
     distinctCalendarMonths:months.size,cash,traded},
   minimums:MA75_MIN_REVIEW_COUNTS,
   externallyVerifiedProviderAndRights:false,
   externallyVerifiedMarketCalendar:false,
   independentlyCertifiedSignalCapture:false,
   independentlyValidatedSplitAdjustments:false,
   independentlyVerifiedRiskAndCosts:false,
   independentlyValidatedForwardWinRate:null,
   eligibleForProduction:false,eligibleForNotifications:false,
   eligibleForAIPowerScoring:false,
   status:technicalPrecheckPass?'AWAITING_INDEPENDENT_EXTERNAL_AUDIT':'RESEARCH_EVIDENCE_INSUFFICIENT',
   warnings:[
    'Technical completeness cannot independently authenticate user-supplied observed timestamps.',
    'Minimum counts are preliminary review gates, not statistical significance or a claim of profitable trading.',
    'The forward baseline, no-retest cash policy, commissions, turnover, drawdown and market-regime independence require external review.',
    'Never turn on live production, alerts, scoring, auto-trading or paid data by using this report.',
   ],
 };
}
