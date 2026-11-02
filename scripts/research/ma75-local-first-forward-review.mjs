#!/usr/bin/env node
/**
 * Offline, read-only first post-freeze MA75 technical-pattern audit.
 * NO J-Quants API requests, no orders, no notification, no app changes.
 * Does not save derived results, does not distribute raw daily bars.
 */
import {readFileSync,readdirSync,lstatSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {validateMa75FrozenUniverse} from '../../app/lib/research/ma75FrozenUniverse.mjs';
import {reviewMa75FirstForwardDay} from '../../app/lib/research/ma75FirstForwardDayShadow.mjs';
import {readMa75PrivateSavedDate,validateMa75SavedDailyForReplay}
 from './ma75-jquants-bulk-retrospective.mjs';
import {runMa75LocalCompletionAudit}
 from './ma75-local-coverage-audit.mjs';

const FREEZE=new URL('../../docs/ma75-forward-cohort-freeze-20261031.json',import.meta.url);
const CURRENT=/^ma75-forward-(20\d\d-\d\d-\d\d)-jquants-daily\.json$/;
const HISTORICAL=/^(20\d\d-\d\d-\d\d)-jquants-daily\.json$/;
const error=code=>{throw new TypeError('MA75_FIRST_FORWARD_LOCAL_'+code)};
export function runMa75LocalFirstForwardReview({
 read=readFileSync,files=readdirSync,fileInfo=lstatSync,
 readCapture=readMa75PrivateSavedDate,
 auditArchive=runMa75LocalCompletionAudit,
 clock=()=>new Date()
}={}){
 const now=clock();
 if(!(now instanceof Date)||!Number.isFinite(now.getTime()))
  error('INVALID_CURRENT_CLOCK');
 const freeze=JSON.parse(read(FREEZE,'utf8'));
 validateMa75FrozenUniverse(freeze);
 const firstDate=freeze.firstEligibleSignalDate;
 if(now.getTime()<Date.parse(firstDate+'T07:30:00Z'))
  error('PUBLISHED_DATE_NOT_REACHED');
 const dir=resolve('research-private');
 const stat=fileInfo(dir);
 if(!stat.isDirectory()||stat.isSymbolicLink())
  error('PRIVATE_DIRECTORY_UNSAFE');
 const archive=auditArchive();
 if(archive?.status!=='OFFLINE_HISTORICAL_DIAGNOSTIC_ONLY'||
    archive.frozenCodes!==freeze.codes.length||
    archive.dates!==122||
    archive.to!=='2026-10-30'||
    archive.preFreeze75SessionWarmup?.requiredHistoricalSessions!==75)
  error('HISTORICAL_ARCHIVE_NOT_RECONCILED');
 const names=files(dir);
 if(!Array.isArray(names)||names.some(name=>typeof name!=='string'))
  error('INVALID_FILE_LIST');
 const currentName='ma75-forward-'+firstDate+'-jquants-daily.json';
 if(!names.includes(currentName))error('FORWARD_DATE_CAPTURE_NOT_FOUND');
 const archiveDates=names.map(name=>HISTORICAL.exec(name)?.[1]??null)
  .filter(Boolean).sort();
 if(archiveDates.length!==archive.dates||archiveDates.at(-1)!==archive.to)
  error('UNEXPECTED_ARCHIVE_DATES');
 const priorDates=archiveDates.slice(-75);
 if(priorDates[0]!==archive.preFreeze75SessionWarmup.sourceFirstDate||
    priorDates.at(-1)!==archive.preFreeze75SessionWarmup.sourceLastDate)
  error('HISTORICAL_WARMUP_DATES_CHANGED');
 const priorProjections=priorDates.map(date=>{
  const saved=readCapture('research-private/'+date+'-jquants-daily.json');
  if(saved===null)error('HISTORICAL_DAY_MISSING');
  return validateMa75SavedDailyForReplay(freeze,date,saved);
 });
 const forwardPath='research-private/'+currentName;
 const saved=readCapture(forwardPath);
 if(saved===null)error('FORWARD_FILE_MISSING');
 const currentProjection=validateMa75SavedDailyForReplay(freeze,firstDate,saved);
 const receipts=saved.pages.map(page=>Date.parse(page.receivedAt));
 if(!receipts.length||receipts.some(t=>!Number.isFinite(t)||t>now.getTime()))
  error('FUTURE_OR_INVALID_ORIGINAL_RECEIPT');
 const report=reviewMa75FirstForwardDay(freeze,{
  priorDates,priorProjections,currentDate:firstDate,currentProjection
 });
 if(report.codesWithCompletePrior75!==archive.preFreeze75SessionWarmup.codesWithAll75ArchivedBars)
  error('WARMUP_COUNT_DISAGREES_WITH_ARCHIVE');
 return {
  ...report,
  capturedOriginalPageCount:saved.pages.length,
  fullMarketOriginalRows:currentProjection.originalAllListedRows,
  frozenProjectedRows:currentProjection.projectedFrozenRows,
  localReceiptFirst:saved.pages[0].receivedAt,
  localReceiptLast:saved.pages.at(-1).receivedAt,
  observationReadAt:now.toISOString(),
  captureTimestampIsSelfReportedByLocalClient:true,
  noOfficialTradingCalendarForFollowingOpen:true,
  independentlyValidatedForwardWinRate:null,
  sourceRightsReviewRequired:true
 };
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 if(process.argv.length!==2){
  process.stderr.write('MA75_FIRST_FORWARD_REVIEW_NO_ARGUMENTS_ALLOWED\n');
  process.exitCode=1;
 }else{
  try{
   const result=runMa75LocalFirstForwardReview();
   // Print classification counts and derived code/volume ratios only:
   // never original licensed source pages, prices or API credentials.
   process.stdout.write(JSON.stringify(result,null,2)+'\n');
  }catch{
   process.stderr.write('MA75_FIRST_FORWARD_REVIEW_BLOCKED_OR_INCOMPLETE\n');
   process.exitCode=1;
  }
 }
}
