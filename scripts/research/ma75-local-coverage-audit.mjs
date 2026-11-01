#!/usr/bin/env node
/**
 * Read-only, OFFLINE audit of one finished MA75 original daily capture.
 * - Never needs API credentials or network
 * - Never changes private cache or full-frozen-cohort headline nulls
 * - The complete-history subset is selection-biased historical DESCRIPTION,
 *   not 953-stock evidence or a post-freeze forward result.
 */
import {readdirSync,readFileSync,lstatSync} from 'node:fs';
import {resolve,relative,isAbsolute,sep} from 'node:path';
import {pathToFileURL} from 'node:url';
import {validateMa75FrozenUniverse} from '../../app/lib/research/ma75FrozenUniverse.mjs';
import {studyMa75BreakoutRetest} from '../../app/lib/research/ma75BreakoutRetest.mjs';
import {
 readMa75PrivateSavedDate,validateMa75SavedDailyForReplay
} from './ma75-jquants-bulk-retrospective.mjs';

const FREEZE=new URL('../../docs/ma75-forward-cohort-freeze-20261031.json',import.meta.url);
const DATE_FILE=/^(20\d\d-\d\d-\d\d)-jquants-daily\.json$/;
const sourcePath=()=>resolve('research-private');
const isPrivateFile=path=>{
 const rel=relative(sourcePath(),resolve(path));
 return rel!==''&&rel!=='..'&&!rel.startsWith('..'+sep)&&!isAbsolute(rel);
};
const invalid=code=>{throw new Error('LOCAL_CAPTURE_AUDIT_'+code)};
const countsEqual=(a,b)=>{
 const keys=new Set([...Object.keys(a??{}),...Object.keys(b??{})]);
 return [...keys].every(key=>(a?.[key]??0)===(b?.[key]??0));
};
const issueReasons=issueMap=>Object.fromEntries([...issueMap].sort((a,b)=>a[0].localeCompare(b[0])));
export function analyzeMa75SavedCompletion({freeze,baselineSummary,dateRecords}){
 validateMa75FrozenUniverse(freeze);
 const summary=baselineSummary;
 if(summary?.version!=='ma75_jquants_bulk_retrospective_v1'||
    summary.status!=='HISTORICAL_ONLY'||summary.provider!=='JQUANTS_V2_ORIGINAL_DAILY'||
    summary.freezeSize!==freeze.codes.length||
    summary.structurallyCompleteFrozenUniverse!==false||
    summary.results!==null||summary.paired!==null||
    summary.independentlyValidatedWinRate!==null||
    summary.eligibleForProduction!==false||summary.eligibleForNotifications!==false)
   invalid('BASELINE_SUMMARY_UNTRUSTED');
 if(!Array.isArray(dateRecords)||dateRecords.length!==summary.sessions||
    summary.providerDateCaptures!==summary.sessions||
    dateRecords.length<91||dateRecords.length>130)
   invalid('DAY_COUNT_MISMATCH');
 const prior=new Map(freeze.codes.map(code=>[code,[]]));
 const reasons={},days=new Set();
 let allRows=0,previous=null;
 for(const entry of dateRecords){
  const date=entry?.date,project=entry?.project;
  if(typeof date!=='string'||date<summary.from||date>summary.to||
     date<=String(previous??'')||days.has(date)||
     project?.date!==date||project.completeProviderPagination!==true||
     !Array.isArray(project.audit?.rows)||project.audit.rows.length!==freeze.codes.length||
     !Number.isSafeInteger(project.originalAllListedRows))
    invalid('DAY_PROJECTION_OR_SEQUENCE_INVALID');
  previous=date;days.add(date);allRows+=project.originalAllListedRows;
  const ids=new Set();
  for(const row of project.audit.rows){
   if(!prior.has(row.code)||ids.has(row.code)||
      typeof row.status!=='string')
    invalid('FROZEN_ROW_MISMATCH');
   ids.add(row.code);
   const item={date,status:row.status,bar:row.status==='DAILY_BAR'?row.bar:null};
   if(row.status==='DAILY_BAR'&&(
     !row.bar||!Number.isFinite(row.bar.open)||
     !Number.isFinite(row.bar.close)||row.bar.tradeDate!==date||
     row.bar.code!==row.code))
    invalid('DAILY_BAR_INTEGRITY');
   prior.get(row.code).push(item);
   if(row.status!=='DAILY_BAR')
    reasons[row.status]=(reasons[row.status]??0)+1;
  }
 }
 if(dateRecords[0].date!==summary.from||
    dateRecords.at(-1).date!==summary.to||
    allRows!==summary.originalAllListedRows||
    summary.expectedCodeSessions!==freeze.codes.length*dateRecords.length||
    !countsEqual(reasons,summary.unavailableFrozenCodeSessionCounts))
   invalid('BASELINE_RECONCILIATION_FAILED');
 const complete=[],issues=[];
 for(const [code,items] of prior){
  if(items.length!==dateRecords.length)invalid('FROZEN_CODE_CHRONOLOGY');
  const bad=items.filter(x=>x.status!=='DAILY_BAR');
  if(!bad.length){
   complete.push({code,timeframe:'1D',candles:items.map(x=>({
    time:Math.floor(Date.parse(x.date+'T00:00:00Z')/1000),
    ...x.bar
   }))});
   continue;
  }
  const perReason={};
  for(const x of bad)perReason[x.status]=(perReason[x.status]??0)+1;
  let unavailableAtStart=0,unavailableAtEnd=0;
  for(const x of items){
   if(x.status==='DAILY_BAR')break;
   unavailableAtStart++;
  }
  for(let i=items.length-1;i>=0;i--){
   if(items[i].status==='DAILY_BAR')break;
   unavailableAtEnd++;
  }
  issues.push({
   code,missingSessions:bad.length,reasonCounts:perReason,
   firstIssue:bad[0].date,lastIssue:bad.at(-1).date,
   unavailableAtStart,unavailableAtEnd
  });
 }
 issues.sort((a,b)=>b.missingSessions-a.missingSessions||a.code.localeCompare(b.code));
 if(complete.length!==summary.fullHistoryCodes||
    issues.length!==summary.incompleteCodes||
    complete.length+issues.length!==freeze.codes.length)
   invalid('FROZEN_DENOMINATOR_MISMATCH');
 const study=studyMa75BreakoutRetest(complete);
 return {
  version:'ma75_local_completion_audit_v1',
  status:'OFFLINE_HISTORICAL_DIAGNOSTIC_ONLY',
  from:summary.from,to:summary.to,
  dates:dateRecords.length,originalRows:allRows,
  frozenCodes:freeze.codes.length,completeHistoryCodes:complete.length,
  incompleteHistoryCodes:issues.length,
  unavailableCodeSessions:issueReasons(Object.entries(reasons)),
  missingByCode:issues,
  historicalCompleteCaseDiagnostic:{
   denominator:'COMPLETE_HISTORY_SUBSET_ONLY_NOT_ALL_FROZEN_CODES',
   selectedFromFrozenUniverseAfterHistoricalPeriod:true,
   codesWithCompleteHistories:complete.length,
   acceptedByStudy:study.acceptedCohorts,
   studyExcludedCount:study.excluded.length,
   studyExcludedReasons:study.excluded.reduce((all,e)=>{
    all[e.reason]=(all[e.reason]??0)+1;return all;
   },{}),
   stats:study.stats,paired:study.paired,
   signalsNotIndependent:true,
   survivorshipAndAvailabilitySelectionBias:true,
   forwardIndependentValidation:false
  },
  full953HeadlineResults:null,
  full953HeadlinePaired:null,
  independentlyValidatedWinRate:null,
  postFreezeCasesExaminedByThisOfflineAudit:0,
  eligibleForProduction:false,
  eligibleForNotifications:false,
  eligibleForAIPowerScoring:false,
  eligibleForTrading:false,
  caveats:[
   'Only the original frozen sample has been examined, not all historical TSE listings.',
   'Case-complete 122-session stocks are selected using future availability, so descriptive subset returns cannot prove an investment edge.',
   'Unadjusted daily bars and 38 corporate-action reviews require separate source verification before interpreting outcomes.',
   'No post-2026-10-31 prospective completed signals: independent forward validation remains required.'
  ]
 };
}

export function runMa75LocalCompletionAudit({
 root=process.cwd(),list=readdirSync,read=readFileSync,
 readCached=readMa75PrivateSavedDate
}={}){
 if(resolve(root)!==resolve(process.cwd()))
   invalid('RUN_ONLY_FROM_REPO_ROOT');
 const dir=sourcePath();
 let dirInfo;
 try{dirInfo=lstatSync(dir)}catch{invalid('PRIVATE_DIRECTORY_NOT_FOUND')}
 if(!dirInfo.isDirectory()||dirInfo.isSymbolicLink())
   invalid('PRIVATE_DIRECTORY_UNSAFE');
 const freeze=JSON.parse(read(FREEZE,'utf8'));
 const summaryFile=resolve(dir,'ma75-jquants-bulk-summary-2026-10-30.json');
 if(!isPrivateFile(summaryFile))
   invalid('SUMMARY_PATH_UNSAFE');
 let summary;
 try{summary=JSON.parse(read(summaryFile,'utf8'))}
 catch{invalid('SUMMARY_MISSING_OR_INVALID')}
 const dates=list(dir).map(name=>DATE_FILE.exec(name)?.[1]??null)
  .filter(date=>date!==null&&date>=summary.from&&date<=summary.to).sort();
 if(dates.length!==summary.sessions||new Set(dates).size!==dates.length)
   invalid('MISSING_OR_DUPLICATED_PRIVATE_DAY_FILES');
 const dateRecords=dates.map(date=>{
  const path=resolve(dir,date+'-jquants-daily.json');
  if(!isPrivateFile(path))invalid('PRIVATE_DATE_PATH_UNSAFE');
  const stored=readCached(path);
  if(stored===null)invalid('DAY_FILE_UNAVAILABLE');
  return {date,project:validateMa75SavedDailyForReplay(freeze,date,stored)};
 });
 return analyzeMa75SavedCompletion({freeze,baselineSummary:summary,dateRecords});
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 if(process.argv.length!==2){
  process.stderr.write('MA75_OFFLINE_AUDIT_NO_ARGUMENTS_ALLOWED\n');
  process.exitCode=1;
 }else{
  try{
   process.stdout.write(JSON.stringify(runMa75LocalCompletionAudit(),null,2)+'\n');
  }catch{
   process.stderr.write('MA75_OFFLINE_AUDIT_BLOCKED_OR_INCOMPLETE\n');
   process.exitCode=1;
  }
 }
}
