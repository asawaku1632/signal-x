import test from "node:test";
import assert from "node:assert/strict";
import {summarizeExportEvidence as coverage} from "../app/lib/research/exportEvidenceCoverage.mjs";
const raw={priorScore:85,priorDate:"2026-10-28",price:100,nextPrice:101,
 sourcePrice:101,sourceDate:"2026-10-30",priorAvailableAt:null,
 priorEvidenceVerified:false,outcomeProvenanceVerified:false};
test("counts raw fields but never authenticates",()=>{const x=coverage([raw]);assert.equal(x.coverage.withPricePair,1);assert.equal(x.coverage.withSourcePrice,1);assert.equal(x.coverage.withPriorAsOfTimestamp,0);assert.equal(x.coverage.independentlyAuthenticated,0);});
test("asserted verification is only a count",()=>{const x=coverage([{...raw,priorEvidenceVerified:true,outcomeProvenanceVerified:true,priorAvailableAt:"2026-10-28T09:00:00+09:00"}]);assert.equal(x.coverage.priorEvidenceAsserted,1);assert.equal(x.coverage.outcomeEvidenceAsserted,1);assert.equal(x.independentAuthenticationPerformed,false);});
test("partial empty and null rows",()=>{const x=coverage([{},null]);assert.equal(x.coverage.rows,2);assert.equal(x.coverage.rowsWithAllRawFields,0);});
test("invalid rows input",()=>assert.throws(()=>coverage({}),/INVALID_EXPORT_EVIDENCE_INPUT/));
test("zero price not valid price pair",()=>assert.equal(coverage([{...raw,price:0}]).coverage.withPricePair,0));
test("no false elevation on absent source",()=>assert.equal(coverage([{...raw,sourcePrice:null}]).coverage.withSourcePrice,0));
