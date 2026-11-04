#!/usr/bin/env node
/** Offline historical-only stratification; no API, database, signals or alerts. */
import {readFileSync,readdirSync,writeFileSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {summarizePost905Cohort} from '../../app/lib/research/post905CohortShadow.mjs';
const PATTERN=/^([0-9]{3}[0-9A-Z])_(20\d{2}-\d{2}-\d{2})\.json$/;
export function stratify(reports){
 const overall=summarizePost905Cohort(reports);
 const group=(key)=>[...new Set(reports.map(r=>r[key]))].sort().map(value=>{
  const s=summarizePost905Cohort(reports.filter(r=>r[key]===value));
  return {value,submitted:s.submitted,accepted:s.accepted,excluded:s.excluded.length,
   uniqueCodes:s.uniqueCodes,uniqueDates:s.uniqueDates,
   meanMaximumUpsidePercent:s.meanMaximumUpsidePercent,
   meanMinimumPriceChangePercent:s.meanMinimumPriceChangePercent,
   thresholds:s.thresholds};
 });
 return {version:'post905_stratified_shadow_v1',overall,
  byDate:group('date'),byCode:group('code'),
  descriptiveOnly:true,independentForwardValidation:false,
  verifiedTradingEdge:false,eligibleForNotifications:false,eligibleForProduction:false};
}
export function loadReports(dir,listing=readdirSync,reader=readFileSync){
 const names=listing(dir).filter(n=>PATTERN.test(n)).sort();
 if(names.length===0||names.length>100)throw new Error('INVALID_REPORT_COUNT');
 return names.map(name=>{
  const raw=reader(join(dir,name),'utf8');
  if(raw.length>100000)throw new Error('OVERSIZE_REPORT');
  const r=JSON.parse(raw),m=PATTERN.exec(name);
  if(!r||typeof r!=='object'||Array.isArray(r)||r.code!==m[1]||r.date!==m[2])
   throw new Error('REPORT_FILENAME_SCOPE_MISMATCH');
  return r;
 });
}
export function main(argv=process.argv.slice(2)){
 if(argv.length!==2||!argv[0].startsWith('--input-dir=')||!argv[1].startsWith('--output='))
  throw new Error('USE_--input-dir=DIR_--output=FILE');
 const dir=argv[0].slice(12),out=argv[1].slice(9);
 if(!dir||!out||!out.endsWith('.json')||resolve(out)===resolve(dir))
  throw new Error('INVALID_PATH');
 const summary=stratify(loadReports(dir));
 writeFileSync(out,JSON.stringify(summary,null,2)+'\n',{encoding:'utf8',flag:'wx',mode:0o600});
 process.stdout.write(JSON.stringify({status:'OFFLINE_STRATIFIED_SUMMARY_CREATED',
  output:out,submitted:summary.overall.submitted,accepted:summary.overall.accepted,
  dateGroups:summary.byDate.length,codeGroups:summary.byCode.length})+'\n');
 return summary;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 try{main()}catch(e){process.stderr.write('STRATIFIED_FAILED: '+(e?.code==='EEXIST'?'OUTPUT_EXISTS':e.message)+'\n');process.exitCode=1}
}
