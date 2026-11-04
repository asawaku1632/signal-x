/** Conservative, offline 09:05 evidence audit. Historical price bars are not live signals. */
const ISO=/^20\d{2}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/;
function timestamp(s){if(typeof s!=='string'||!ISO.test(s))return null;const n=Date.parse(s);return Number.isFinite(n)?n:null;}
export function auditAsOf905Evidence(report,evidence){
 const code=report?.code,date=report?.date,p=report?.post905;
 const scope=typeof code==='string'&&typeof date==='string'&&
  p?.code===code&&p?.date===date&&p?.hindsightOnly===true&&
  p?.eligibleForProduction===false&&p?.eligibleForNotifications===false;
 const cutoff=timestamp(date+'T09:05:00+09:00');
 const generated=timestamp(evidence?.generatedAt);
 const received=timestamp(evidence?.receivedAt);
 const barEnd=timestamp(evidence?.lastInputBarEndAt);
 const source=typeof evidence?.source==='string'&&evidence.source.trim().length>0;
 const independent=evidence?.independentCapture===true;
 const matching=evidence?.code===code&&evidence?.date===date;
 const chronologicallyValid=cutoff!==null&&generated!==null&&received!==null&&barEnd!==null&&
  barEnd<=received&&received<=generated&&generated<=cutoff;
 const evidenceComplete=Boolean(scope&&matching&&source&&independent&&chronologicallyValid);
 const blockers=[];
 if(!scope)blockers.push('UNVERIFIED_HISTORICAL_REPORT_SCOPE');
 if(!matching)blockers.push('EVIDENCE_SCOPE_MISMATCH');
 if(!source)blockers.push('MISSING_SOURCE');
 if(!independent)blockers.push('NO_INDEPENDENT_CAPTURE');
 if(!chronologicallyValid)blockers.push('MISSING_OR_LATE_AS_OF_TIMESTAMPS');
 // Independent capture is necessary but not sufficient to validate a trade signal.
 blockers.push('NO_INDEPENDENT_SIGNAL_REPLAY');
 blockers.push('NO_OUT_OF_SAMPLE_FORWARD_VALIDATION');
 return {version:'post905_asof_evidence_audit_v1',code:code??null,date:date??null,
  asOfCutoffJst:'09:05:00',captureEvidenceChronologicallyComplete:evidenceComplete,
  blockers,hindsightOnly:true,verifiedTradingEdge:false,
  eligibleForNotifications:false,eligibleForProduction:false};
}
