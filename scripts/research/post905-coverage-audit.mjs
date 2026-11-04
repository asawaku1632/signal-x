#!/usr/bin/env node
/** Offline diagnostic for saved historical pilot reports. No API, DB, or production writes. */
import {readFileSync,readdirSync,writeFileSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
const NAME=/^([0-9]{3}[0-9A-Z])_(20\d{2}-\d{2}-\d{2})\.json$/;
const CLOCK=['09:00','09:01','09:02','09:03','09:04'];
export function auditReport(r){
 const p=r?.post905;
 const count=p?.pre905BarCount;
 const times=p?.observedPre905Minutes;
 const validTimes=Array.isArray(times)&&new Set(times).size===times.length&&
  times.every(t=>CLOCK.includes(t))&&times.length===count;
 const missing=validTimes?CLOCK.filter(t=>!times.includes(t)):null;
 const reconciled=r?.status==='HISTORICAL_MINUTE_DAILY_STRUCTURAL_MATCH'&&
  r.dailyReconciliationMatched===true&&r.pageChainComplete===true&&
  r.historicalQualityHold===false&&r.metricsReleasedForHistoricalResearch===true;
 const usable=reconciled&&count===5&&p?.post905MorningBarCount>0&&
  p?.eligibleForProduction===false&&p?.eligibleForNotifications===false;
 return {code:r?.code??null,date:r?.date??null,
  reconciledHistoricalOHLCV:reconciled,pre905ObservedBarCount:Number.isInteger(count)?count:null,
  observedPre905Minutes:validTimes?times:null,missingPre905Minutes:missing,
  missingMinuteCause:missing?.length?'UNKNOWN_NO_TRADE_OR_DATA_GAP':null,
  timestampEvidence:validTimes?'SAVED_MINUTE_CLOCK_SLOTS':'NOT_RETAINED_IN_REPORT',
  cohortCandidate:usable,actual905AvailabilityVerified:false,
  eligibleForNotifications:false,eligibleForProduction:false};
}
export function auditDirectory(dir,reader=readFileSync,listing=readdirSync){
 const names=listing(dir).filter(n=>NAME.test(n)).sort();
 if(names.length===0||names.length>100)throw new Error('INVALID_REPORT_COUNT');
 const entries=names.map(name=>{
  const raw=reader(join(dir,name),'utf8');
  if(raw.length>100000)throw new Error('OVERSIZE_REPORT');
  const r=JSON.parse(raw);
  const match=NAME.exec(name);
  if(!r||r.code!==match[1]||r.date!==match[2])throw new Error('FILENAME_REPORT_SCOPE_MISMATCH');
  return auditReport(r);
 });
 return {version:'post905_coverage_audit_v1',reports:entries,
  missingClockEvidenceCount:entries.filter(e=>e.timestampEvidence==='NOT_RETAINED_IN_REPORT').length,
  noTradeVersusGapIndependentlyVerified:false,
  eligibleForNotifications:false,eligibleForProduction:false};
}
export function main(argv=process.argv.slice(2)){
 if(argv.length!==2||!argv[0].startsWith('--input-dir=')||!argv[1].startsWith('--output='))
  throw new Error('USE_--input-dir=DIR_--output=FILE');
 const dir=argv[0].slice(12),out=argv[1].slice(9);
 if(!dir||!out||!out.endsWith('.json')||resolve(out)===resolve(dir))throw new Error('INVALID_PATH');
 const report=auditDirectory(dir);
 writeFileSync(out,JSON.stringify(report,null,2)+'\n',{encoding:'utf8',flag:'wx',mode:0o600});
 process.stdout.write(JSON.stringify({status:'OFFLINE_COVERAGE_AUDIT_CREATED',output:out,reports:report.reports.length})+'\n');
 return report;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 try{main()}catch(e){process.stderr.write('AUDIT_FAILED: '+(e?.code==='EEXIST'?'OUTPUT_EXISTS':e.message)+'\n');process.exitCode=1}
}
