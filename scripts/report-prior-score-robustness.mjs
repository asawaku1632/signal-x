#!/usr/bin/env node
/**
 * Explicit offline file-only research. No DB credentials, APIs, network or writes.
 * Example: node scripts/report-prior-score-robustness.mjs ./approved-export.json
 * The file must contain an ARRAY of audited observations, not database secrets.
 */
import {readFileSync} from "node:fs";
import {researchPriorScoreDailyGaps} from "../app/lib/research/priorScoreRobustness.mjs";
import {classifyResearchEvidence} from "../app/lib/research/evidenceClassifier.mjs";
import {normalizeDailyExportRows} from "../app/lib/research/dailyExportNormalizer.mjs";
export function parseResearchFile(raw){
 if(typeof raw!=="string"||Buffer.byteLength(raw)>25*1024*1024)throw Error("INVALID_RESEARCH_FILE_SIZE");
 const parsed=JSON.parse(raw);
 if(!Array.isArray(parsed)||parsed.length>100000)throw Error("INVALID_RESEARCH_ROWS");
 return parsed;
}
export function auditResearchRows(rows){
 const counts={unverifiedPriorRows:0,unverifiedOutcomeRows:0,invalidObjectRows:0};
 for(const row of rows){
  if(!row||typeof row!=="object"||Array.isArray(row)){counts.invalidObjectRows++;continue;}
  if(row.priorEvidenceVerified!==true||typeof row.priorDate!=="string")counts.unverifiedPriorRows++;
  if(row.outcomeProvenanceVerified!==true||typeof row.outcomeDate!=="string")counts.unverifiedOutcomeRows++;
 }
 return {inputRows:rows.length,...counts,independentlyVerifiedByCli:false};
}
export function reportFromText(raw){
 const parsed=parseResearchFile(raw);
 const fromSql=parsed.some(x=>x&&typeof x==="object"&&Object.hasOwn(x,"next_price"));
 const rows=fromSql?normalizeDailyExportRows(parsed):parsed;
 const inputAudit=auditResearchRows(rows);
 const classification=classifyResearchEvidence(rows);
 // Only pass rows whose claims are structurally consistent; assertions are NOT authentication.
 // Map the canonical evidence source date to the existing daily-gap evaluator.
 const eligibleRows=rows.filter((_,i)=>classification.results[i].status==="EVIDENCE_ASSERTED")
  .map(row=>({...row,outcomeDate:row.sourceDate}));
 const report=researchPriorScoreDailyGaps(eligibleRows);
 return {researchOnly:true,source:"USER_APPROVED_LOCAL_FILE",recordCount:rows.length,sqlExportNormalized:fromSql,
   inputAudit,evidenceClassification:{
     version:classification.version,summary:classification.summary,
     independentlyVerified:false,warning:classification.warning
   },assertedRowsPassedToAnalysis:eligibleRows.length,...report};
}
if(process.argv[1]&&import.meta.url===new URL("file://"+process.argv[1]).href){
 const args=process.argv.slice(2);
 if(args.length!==1||args[0].startsWith("-")){
  process.stderr.write("Usage: node scripts/report-prior-score-robustness.mjs <approved-export.json>\n");
  process.exitCode=2;
 }else{
  try{process.stdout.write(JSON.stringify(reportFromText(readFileSync(args[0],"utf8")),null,2)+"\n");}
  catch(e){process.stderr.write("Research input rejected: "+e.message+"\n");process.exitCode=1;}
 }
}
