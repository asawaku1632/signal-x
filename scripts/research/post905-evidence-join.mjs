#!/usr/bin/env node
/** Offline join of historical reports with separately captured as-of evidence. */
import {readFileSync,readdirSync,writeFileSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {loadReports} from './post905-stratified-summary.mjs';
import {auditAsOf905Evidence} from '../../app/lib/research/post905AsOfEvidenceAudit.mjs';
const NAME=/^([0-9]{3}[0-9A-Z])_(20\d{2}-\d{2}-\d{2})\.json$/;
export function joinEvidence(reports,evidenceByKey=new Map()){
 const seen=new Set();
 const items=reports.map(report=>{
  const key=report.code+'|'+report.date;
  if(seen.has(key))throw new Error('DUPLICATE_REPORT_SCOPE');
  seen.add(key);
  const evidence=evidenceByKey.get(key)??null;
  return {...auditAsOf905Evidence(report,evidence),evidencePresent:evidence!==null};
 });
 const unknown=[...evidenceByKey.keys()].filter(k=>!seen.has(k));
 if(unknown.length)throw new Error('EVIDENCE_WITHOUT_MATCHING_REPORT');
 return {version:'post905_evidence_join_v1',submitted:items.length,
  withEvidence:items.filter(x=>x.evidencePresent).length,
  chronologicallyComplete:items.filter(x=>x.captureEvidenceChronologicallyComplete).length,
  items,verifiedTradingEdge:false,eligibleForNotifications:false,eligibleForProduction:false};
}
export function loadEvidence(dir,listing=readdirSync,reader=readFileSync){
 const files=listing(dir).filter(n=>NAME.test(n)).sort();
 if(files.length>100)throw new Error('TOO_MANY_EVIDENCE_FILES');
 const map=new Map();
 for(const name of files){
  const raw=reader(join(dir,name),'utf8');
  if(raw.length>100000)throw new Error('OVERSIZE_EVIDENCE');
  const value=JSON.parse(raw),m=NAME.exec(name),key=m[1]+'|'+m[2];
  if(!value||typeof value!=='object'||Array.isArray(value)||
     value.code!==m[1]||value.date!==m[2]||map.has(key))
   throw new Error('INVALID_EVIDENCE_SCOPE');
  map.set(key,value);
 }
 return map;
}
export function main(argv=process.argv.slice(2)){
 if(argv.length!==3||!argv[0].startsWith('--reports-dir=')||
    !argv[1].startsWith('--evidence-dir=')||!argv[2].startsWith('--output='))
  throw new Error('USE_--reports-dir=DIR_--evidence-dir=DIR_--output=FILE');
 const reportDir=argv[0].slice(14),evidenceDir=argv[1].slice(15),out=argv[2].slice(9);
 if(!reportDir||!evidenceDir||!out||!out.endsWith('.json')||
    resolve(out)===resolve(reportDir)||resolve(out)===resolve(evidenceDir))
  throw new Error('INVALID_PATH');
 const result=joinEvidence(loadReports(reportDir),loadEvidence(evidenceDir));
 writeFileSync(out,JSON.stringify(result,null,2)+'\n',{encoding:'utf8',flag:'wx',mode:0o600});
 process.stdout.write(JSON.stringify({status:'OFFLINE_EVIDENCE_JOIN_CREATED',output:out,
  submitted:result.submitted,withEvidence:result.withEvidence,
  chronologicallyComplete:result.chronologicallyComplete})+'\n');
 return result;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 try{main()}catch(e){process.stderr.write('EVIDENCE_JOIN_FAILED: '+(e?.code==='EEXIST'?'OUTPUT_EXISTS':e.message)+'\n');process.exitCode=1}
}
