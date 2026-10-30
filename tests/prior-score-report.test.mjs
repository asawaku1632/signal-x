import test from "node:test";
import assert from "node:assert/strict";
import {parseResearchFile,reportFromText} from "../scripts/report-prior-score-robustness.mjs";
const row=(code,score)=>({date:"2026-11-02",code,priorDate:"2026-10-30",priorScore:score,priorEvidenceVerified:true,price:100,nextPrice:101,outcomeDate:"2026-11-04",outcomeProvenanceVerified:true});
test("parses approved JSON array",()=>assert.equal(parseResearchFile("[]").length,0));
test("rejects JSON object",()=>assert.throws(()=>parseResearchFile("{}"),/INVALID_RESEARCH_ROWS/));
test("rejects malformed JSON",()=>assert.throws(()=>parseResearchFile("oops")));
test("rejects nontext",()=>assert.throws(()=>parseResearchFile(null),/INVALID_RESEARCH_FILE_SIZE/));
test("rejects too many records",()=>assert.throws(()=>parseResearchFile(JSON.stringify(new Array(100001).fill(null))),/INVALID_RESEARCH_ROWS/));
test("rejects oversize",()=>assert.throws(()=>parseResearchFile(" ".repeat(25*1024*1024+1)),/INVALID_RESEARCH_FILE_SIZE/));
test("report remains research-only",()=>{const r=reportFromText(JSON.stringify([row("1234",85),row("1235",70)]));assert.equal(r.researchOnly,true);assert.equal(r.shadowOnly,true);assert.equal(r.recordCount,2);});
test("no qualified day with default min sample",()=>assert.equal(reportFromText(JSON.stringify([row("1234",85),row("1235",70)])).days,0));

test("reports missing provenance assertions explicitly",()=>{
 const input=[row("1234",85),{...row("1235",70),priorEvidenceVerified:false,outcomeProvenanceVerified:false}];
 const result=reportFromText(JSON.stringify(input));
 assert.equal(result.inputAudit.unverifiedPriorRows,1);
 assert.equal(result.inputAudit.unverifiedOutcomeRows,1);
 assert.equal(result.inputAudit.independentlyVerifiedByCli,false);
});
test("does not certify even asserted evidence",()=>{
 const result=reportFromText(JSON.stringify([row("1234",85)]));
 assert.equal(result.inputAudit.unverifiedPriorRows,0);
 assert.equal(result.inputAudit.independentlyVerifiedByCli,false);
});

test("classifier gate reports reasons before date comparison",()=>{
 const valid={...row("1234",85),priorAvailableAt:"2026-10-30T15:00:00+09:00",
  sourceDate:"2026-11-04",sourcePrice:101};
 const unverified={...valid,code:"1235",priorEvidenceVerified:false};
 const wrongPrice={...valid,code:"1236",sourcePrice:99};
 const result=reportFromText(JSON.stringify([valid,unverified,wrongPrice]));
 assert.equal(result.evidenceClassification.summary.total,3);
 assert.equal(result.evidenceClassification.summary.verified,1);
 assert.equal(result.evidenceClassification.summary.missingPrior,1);
 assert.equal(result.evidenceClassification.summary.priceMismatch,1);
 assert.equal(result.assertedRowsPassedToAnalysis,1);
 assert.equal(result.evidenceClassification.independentlyVerified,false);
});
test("rejects future feature timestamp even if asserted",()=>{
 const value={...row("1234",85),priorAvailableAt:"2026-11-02T09:00:00+09:00",
  sourceDate:"2026-11-04",sourcePrice:101};
 const result=reportFromText(JSON.stringify([value]));
 assert.equal(result.evidenceClassification.summary.latePrior,1);
 assert.equal(result.assertedRowsPassedToAnalysis,0);
});

test("SQL-format export cannot self-certify provenance or enter analysis",()=>{
 const rows=[{date:"2026-11-02",code:"1234",price:"100",next_price:"102",
  prior_date:"2026-10-30",prior_score:"90",source_date:"2026-11-04",
  source_price:"102",prior_available_at:"2026-10-30T15:00:00+09:00",
  prior_evidence_verified:true,outcome_provenance_verified:true}];
 const report=reportFromText(JSON.stringify(rows));
 assert.equal(report.sqlExportNormalized,true);
 assert.equal(report.evidenceClassification.summary.missingPrior,1);
 assert.equal(report.assertedRowsPassedToAnalysis,0);
 assert.equal(report.days,0);
 assert.equal(report.evidenceClassification.independentlyVerified,false);
});
