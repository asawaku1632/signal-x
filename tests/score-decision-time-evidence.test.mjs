import test from "node:test";import assert from "node:assert/strict";
import {auditScoreDecisionTimeEvidence as audit} from "../app/lib/research/scoreDecisionTimeEvidence.mjs";
const x={date:"2026-10-21",created_at:"2026-10-21 06:35:36.076773"};
test("early naive time does not prove ex ante score",()=>{const r=audit(x);assert.equal(r.claimedBeforeLocalCutoff,true);assert.equal(r.exAnteScoreVerified,false);assert.equal(r.eligibleForModelTraining,false);});
test("later time rejected",()=>assert.equal(audit({...x,created_at:"2026-10-21 10:00:00"}).reason,"NOT_BEFORE_CUTOFF"));
test("different date rejected",()=>assert.equal(audit({...x,date:"2026-10-22"}).reason,"INVALID_OR_MISMATCHED_CREATED_AT"));
test("absent time rejected",()=>assert.equal(audit({...x,created_at:null}).exAnteScoreVerified,false));
test("timezone-bearing time not silently parsed as naive",()=>assert.equal(audit({...x,created_at:"2026-10-21T06:35:36+09:00"}).reason,"INVALID_OR_MISMATCHED_CREATED_AT"));
test("cannot allow notifications",()=>assert.equal(audit(x).eligibleForAlerts,false));
