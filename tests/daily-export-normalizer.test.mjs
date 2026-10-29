import test from "node:test";
import assert from "node:assert/strict";
import {normalizeDailyExportRows as normalize} from "../app/lib/research/dailyExportNormalizer.mjs";
const row={date:"2026-10-27",code:"1234",price:"100",next_price:"102",prior_date:"2026-10-26",prior_score:"90",source_date:"2026-10-28",source_price:"102",prior_evidence_verified:true,outcome_provenance_verified:true,prior_available_at:"2026-10-26T10:00:00+09:00"};
test("normalizes snake case and numeric strings",()=>{const [r]=normalize([row]);assert.equal(r.nextPrice,102);assert.equal(r.priorScore,90);});
test("does not trust caller provenance flags",()=>{const [r]=normalize([row]);assert.equal(r.priorEvidenceVerified,false);assert.equal(r.outcomeProvenanceVerified,false);assert.equal(r.priorAvailableAt,null);});
test("null prices remain null",()=>assert.equal(normalize([{...row,next_price:null}])[0].nextPrice,null));
test("bad numeric text remains null",()=>assert.equal(normalize([{...row,source_price:"oops"}])[0].sourcePrice,null));
test("no object returns null",()=>assert.equal(normalize([null])[0],null));
test("non-array rejected",()=>assert.throws(()=>normalize({}),/INVALID_EXPORT_ROWS/));

test("source snapshot time is metadata not independent verification",()=>{const x=normalize([{date:"2026-10-28",code:"1234",source_snapshot_created_at:"2026-10-29 15:00:00",prior_evidence_verified:true,outcome_provenance_verified:true}])[0];assert.equal(x.sourceSnapshotCreatedAt,"2026-10-29 15:00:00");assert.equal(x.priorEvidenceVerified,false);assert.equal(x.outcomeProvenanceVerified,false);});
