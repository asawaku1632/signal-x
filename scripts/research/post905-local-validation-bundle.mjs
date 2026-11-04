#!/usr/bin/env node
/** Offline validation of already-saved minute reports. No database or network. */
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { inventoryDirectory } from './post905-local-source-inventory.mjs';
import { loadReports } from './post905-stratified-summary.mjs';
import { assessResearchReadiness } from './post905-research-readiness.mjs';

export function planNextEvidence(readiness) {
  const next = [];
  if (readiness.acceptedDates < 2) next.push({code:'MORE_DISTINCT_DATES',minimumAdditionalDates:2-readiness.acceptedDates,action:'Add historical minute reports for a different trading date; no paid retrieval is initiated'});
  if (readiness.reportsWithoutPre905TimestampEvidence > 0) next.push({code:'PRE905_TIMESTAMP_EVIDENCE',affectedReports:readiness.reportsWithoutPre905TimestampEvidence,action:'Inspect actual bar-end and availability timestamps; never synthesize capture times'});
  next.push({code:'INDEPENDENT_ASOF_REPLAY',action:'Independently replay inputs available by 09:05 JST; historical reports alone are insufficient'});
  next.push({code:'FORWARD_AND_COST_VALIDATION',action:'Only after replay, measure out-of-sample returns, slippage, fees and fill feasibility'});
  return next;
}

export function validateLocalReports(directory) {
  const inventory=inventoryDirectory(directory);
  const readiness=assessResearchReadiness(loadReports(directory));
  const mismatch=inventory.invalidReportFiles>0 || inventory.minuteReportFiles!==readiness.submitted;
  return {
    version:'post905_local_validation_bundle_v1',
    inventory, readiness, nextEvidenceSteps:planNextEvidence(readiness),
    consistentReportCounts:!mismatch,
    verificationStatus:mismatch?'REVIEW_REQUIRED':'DESCRIPTIVE_ONLY',
    historicalOnly:true, independentReplayVerified:false,
    verifiedTradingEdge:false, eligibleForNotifications:false, eligibleForProduction:false
  };
}
export function main(argv=process.argv.slice(2)) {
  if(argv.length!==2 || !argv[0].startsWith('--input-dir=') || !argv[1].startsWith('--output='))
    throw new Error('USE_--input-dir=DIR_--output=FILE');
  const directory=argv[0].slice(12), output=argv[1].slice(9);
  if(!directory||!output||!output.endsWith('.json')||resolve(directory)===resolve(output))
    throw new Error('INVALID_PATH');
  const result=validateLocalReports(directory);
  writeFileSync(output,JSON.stringify(result,null,2)+'\n',{flag:'wx',mode:0o600});
  return {status:'LOCAL_VALIDATION_CREATED',submitted:result.readiness.submitted,
    accepted:result.readiness.accepted,excluded:result.readiness.excluded,
    consistentReportCounts:result.consistentReportCounts,
    gaps:result.readiness.gaps,output};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href) {
 try {console.log(JSON.stringify(main()));}
 catch(e){console.error('LOCAL_VALIDATION_FAILED:',e?.code==='EEXIST'?'OUTPUT_EXISTS':e.message);process.exitCode=1;}
}
