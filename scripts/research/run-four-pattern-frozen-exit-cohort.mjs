#!/usr/bin/env node
/**
 * Local-only frozen six-stock research outcome audit.
 * --plan prints the exact required J-Quants capture dates and private filenames.
 * --evaluate reads 12 explicit pinned filenames in .private-research.
 * Never calls J-Quants, issues orders, writes files or prints provider rows.
 */
import {readFileSync,statSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {REPLICATION_PLAN,verifyFourPatternReplicationPlan}
 from '../../app/lib/research/fourPatternReplicationPlan.mjs';
import {pinnedExitFollowupDates,evaluateFrozenFourPatternExitCohort}
 from '../../app/lib/research/fourPatternExitFollowup.mjs';

const MAX_PRIVATE_ARCHIVE_SIZE=8_000_000;
export function pinnedFollowupManifest(){
 const dates=pinnedExitFollowupDates();
 const base=REPLICATION_PLAN.plannedNextPeriod;
 const filename=(code,start,end)=>'four-pattern-jquants-'+code+'-'+start+'-'+end+'.json';
 return {status:'FUTURE_CAPTURE_MANIFEST_PLAN_ONLY',
  plannedSignalDates:base.tradingDates,
  outcomeFollowupDates:dates,codeList:base.codes,
  archivePairs:base.codes.map(code=>({code,
   signalArchive:filename(code,base.start,base.end),
   exitOnlyArchive:filename(code,dates[0],dates.at(-1)),
  })),
  capturePerCodeMaximumDates:20,
  marketDataAvailabilityNotChecked:true,
  automaticCapture:false,apiRequestsFromThisTool:0,
  existingFilesModified:false,canTriggerTrade:false,canTriggerNotification:false};
}
function readPrivate(root,name){
 const file=join(root,name);
 const stat=statSync(file);
 if(!stat.isFile()||stat.size<2||stat.size>MAX_PRIVATE_ARCHIVE_SIZE)
  throw Error('INVALID_OR_OVERSIZED_PRIVATE_ARCHIVE');
 const archive=JSON.parse(readFileSync(file,'utf8'));
 if(archive===null||typeof archive!=='object'||Array.isArray(archive))
  throw Error('INVALID_PRIVATE_ARCHIVE_PAYLOAD');
 return archive;
}
export function runFrozenExitCohortLocal(argv=[],{
 readArchive=null,
}={}){
 if(argv.length!==1||!['--plan','--evaluate'].includes(argv[0]))
  return {status:'BLOCKED_USE_PLAN_OR_EXPLICIT_EVALUATE',
   eligibleForProduction:false,eligibleForNotifications:false};
 const plan=verifyFourPatternReplicationPlan();
 if(plan.status!=='PREDECLARED_HOLDOUT_PLAN_ONLY')
  return {status:'BLOCKED_REPLICATION_PLAN_UNVERIFIED',
   eligibleForProduction:false,eligibleForNotifications:false};
 const manifest=pinnedFollowupManifest();
 if(argv[0]==='--plan')return manifest;
 const reader=readArchive??(name=>readPrivate(resolve('.private-research'),name));
 const items=manifest.archivePairs.map(({signalArchive,exitOnlyArchive})=>({
  originalArchive:reader(signalArchive),
  followupArchive:reader(exitOnlyArchive),
 }));
 return evaluateFrozenFourPatternExitCohort(items);
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{
  const r=runFrozenExitCohortLocal(process.argv.slice(2));
  if(!r.status.startsWith('BLOCKED_'))console.log(JSON.stringify(r,null,2));
  else console.error('FOUR_PATTERN_FROZEN_EXIT_BLOCKED',r.status);
  if(!['FUTURE_CAPTURE_MANIFEST_PLAN_ONLY',
   'FROZEN_SIX_STOCK_EXIT_TAIL_RECONCILED_SHADOW_ONLY'].includes(r.status))
   process.exitCode=1;
 }catch(error){
  // Never print raw file paths, JSON parse errors or licensed archive bytes.
  const code=error instanceof Error&&/^[A-Z][A-Z0-9_]+$/.test(error.message)?
   error.message:'PRIVATE_ARCHIVES_MISSING_OR_INVALID';
  console.error('FOUR_PATTERN_FROZEN_EXIT_BLOCKED',code);
  process.exitCode=1;
 }
}
