#!/usr/bin/env node
/** Offline validation of already-saved minute reports. No database or network. */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { inventoryDirectory } from './post905-local-source-inventory.mjs';
import { loadReports } from './post905-stratified-summary.mjs';
import { assessResearchReadiness } from './post905-research-readiness.mjs';

export function validateLocalReports(directory) {
  const inventory=inventoryDirectory(directory);
  const readiness=assessResearchReadiness(loadReports(directory));
  const mismatch=inventory.invalidReportFiles>0 || inventory.minuteReportFiles!==readiness.submitted;
  return {
    version:'post905_local_validation_bundle_v1',
    inventory, readiness,
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
