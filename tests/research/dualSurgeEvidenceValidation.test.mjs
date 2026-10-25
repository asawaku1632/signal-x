import test from "node:test";
import assert from "node:assert/strict";
import {validateEvidenceEntry} from "../../app/lib/research/dualSurgeEvidenceValidation.mjs";
const valid=()=>({verified:true,evidenceUrl:"https://example.org/approval",reviewer:"auditor",reviewedAt:"2026-10-24T00:00:00Z",expiresAt:"2026-11-01T00:00:00Z"});
const cutoff="2026-10-25T00:00:00Z";
test("valid synthetic evidence passes shape checks only",()=>assert.equal(validateEvidenceEntry(valid(),cutoff),true));
test("revoked evidence is blocked",()=>assert.equal(validateEvidenceEntry({...valid(),revoked:true},cutoff),false));
test("expired evidence is blocked",()=>assert.equal(validateEvidenceEntry({...valid(),expiresAt:"2026-10-24T00:00:00Z"},cutoff),false));
test("future review is blocked",()=>assert.equal(validateEvidenceEntry({...valid(),reviewedAt:"2026-10-26T00:00:00Z"},cutoff),false));
test("rejected and contradictory status is blocked",()=>assert.equal(validateEvidenceEntry({...valid(),status:"REJECTED"},cutoff),false));
test("missing reviewer and insecure URL blocked",()=>{assert.equal(validateEvidenceEntry({...valid(),reviewer:""},cutoff),false);assert.equal(validateEvidenceEntry({...valid(),evidenceUrl:"http://example.org"},cutoff),false);});
test("invalid timestamps and missing evidence blocked",()=>{assert.equal(validateEvidenceEntry({...valid(),expiresAt:"invalid"},cutoff),false);assert.equal(validateEvidenceEntry(null,cutoff),false);});

test("bare https prefix is not a valid evidence URL",()=>assert.equal(validateEvidenceEntry({...valid(),evidenceUrl:"https://"},cutoff),false));
test("embedded credentials are rejected from evidence URL",()=>assert.equal(validateEvidenceEntry({...valid(),evidenceUrl:"https://user:secret@example.org/approval"},cutoff),false));
test("timezone-less review date is rejected",()=>assert.equal(validateEvidenceEntry({...valid(),reviewedAt:"2026-10-24T00:00:00"},cutoff),false));
test("timezone-less expiry date is rejected",()=>assert.equal(validateEvidenceEntry({...valid(),expiresAt:"2026-11-01T00:00:00"},cutoff),false));
test("timezone-less audit cutoff is rejected",()=>assert.equal(validateEvidenceEntry(valid(),"2026-10-25T00:00:00"),false));
