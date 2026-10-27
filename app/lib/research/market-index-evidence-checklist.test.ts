import test from "node:test";
import assert from "node:assert/strict";
import { assessIndexEvidenceChecklist, INDEX_EVIDENCE_REQUIREMENTS } from "./market-index-evidence-checklist.ts";
test("missing evidence remains blocked and reports all requirements", () => {
  const result = assessIndexEvidenceChecklist(null);
  assert.equal(result.state, "blocked");
  assert.equal(result.remaining.length, INDEX_EVIDENCE_REQUIREMENTS.length);
  assert.equal(result.confirmedClaims, 0);
});
test("even all claimed evidence cannot activate connection or production", () => {
  const claims = Object.fromEntries(INDEX_EVIDENCE_REQUIREMENTS.map(x => [x.code, true]));
  const result = assessIndexEvidenceChecklist(claims);
  assert.equal(result.remaining.length, 0);
  assert.deepEqual([result.canConnect,result.canStore,result.canSchedule,result.canPublish], [false,false,false,false]);
  assert.equal(result.state, "blocked");
});
test("string booleans do not count as verified claims", () => {
  const result = assessIndexEvidenceChecklist({ NIKKEI_LICENSE: "true", TOPIX_LICENSE: 1 });
  assert.equal(result.confirmedClaims, 0);
});
test("arrays and invalid inputs are not accepted as evidence", () => {
  for (const input of [[], "", 5, undefined]) {
    assert.equal(assessIndexEvidenceChecklist(input).confirmedClaims, 0);
  }
});
