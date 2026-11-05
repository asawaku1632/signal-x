#!/usr/bin/env node
/**
 * Offline report from complete private raw archives captured by the
 * opt-in J-Quants command. No network, secrets, DB, notifications or orders.
 */
import {readFileSync,statSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {studyCapturedJQuantsFourPatterns} from '../../app/lib/research/fourPatternJQuantsBridge.mjs';

export function summarizeFourPatternJQuantsArchive(archive,timeframe='BOTH') {
 const result=studyCapturedJQuantsFourPatterns({...archive,timeframe});
 if(result.status!=='HISTORICAL_RECONCILED_SHADOW_ONLY')
  return {status:result.status,code:archive.code,
   eligibleForNotifications:false,eligibleForProduction:false};
 return {
  status:result.status,code:result.code,
  validatedTradeDates:result.verifiedMinuteDays,
  observedOneMinuteBars:result.capturedOriginalMinutes,
  financialStatus:result.financialStatus,
  financialMetadataQuarantineCount:result.financialMetadataQuarantineCount??0,
  financialMetadataCounts:result.financialMetadataCounts??null,
  financialSnapshotsUsableOnlyAfterCapture:result.financialAsOfSnapshots,
  qualityFinancialPatternEnabled:result.financialStatus==='CAPTURE_GATED_FINANCIAL_ONLY'&&
   result.financialAsOfSnapshots>0,
  dataSource:'JQUANTS_V2_HISTORICAL_PRIVATE_CAPTURE',
  results:result.reports.map(({timeframe,report})=>({
   timeframe,status:report.status,
   signals:report.status==='OFFLINE_SHADOW_ONLY'?report.rows.length:null,
   summaries:report.summaries.map(x=>({
    strategy:x.strategy,signals:x.signals,measured5:x.measured5,
    pending5:x.pending5,winRate5Percent:x.winRate5Percent,
    averageReturn5Percent:x.averageReturn5Percent,
    averageProfit5Yen100:x.averageProfit5Yen100,
   })),
  })),
  closeOnly:true,licensedRawRowsNotPrinted:true,
  historicalDataNotLive:true,canTriggerTrade:false,canTriggerNotification:false,
 };
}
export function runFourPatternJQuantsArchive(argv) {
 const [path,option]=argv;
 if(!path||argv.length>2||option&&
  !['--timeframe=30m','--timeframe=60m','--timeframe=BOTH'].includes(option))
  throw Error('USAGE_ARCHIVE_PATH_OPTIONAL_TIMEFRAME');
 if(statSync(path).size>8_000_000)throw Error('ARCHIVE_TOO_LARGE');
 const archive=JSON.parse(readFileSync(path,'utf8'));
 if(!archive||typeof archive!=='object'||Array.isArray(archive))
  throw Error('INVALID_ARCHIVE');
 return summarizeFourPatternJQuantsArchive(archive,option?.split('=')[1]??'BOTH');
}
const running=process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url);
if(running){
 try{
  const output=runFourPatternJQuantsArchive(process.argv.slice(2));
  console.log(JSON.stringify(output,null,2));
  if(output.status!=='HISTORICAL_RECONCILED_SHADOW_ONLY')process.exitCode=1;
 }catch(error){
  console.error('RESEARCH_REVIEW_BLOCKED',
   error instanceof Error&&/^[A-Z_0-9]+$/.test(error.message)?
   error.message:'INVALID_ARCHIVE_OR_ARGUMENT');
  process.exitCode=1;
 }
}
