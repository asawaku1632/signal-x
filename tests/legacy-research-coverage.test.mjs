import test from "node:test";
import assert from "node:assert/strict";
import {auditLegacyCoverage as audit} from "../app/lib/research/legacyResearchCoverage.mjs";
test("large legacy dataset remains retrospective-only",()=>{
 const a=audit({startDate:"2026-07-01",endDate:"2026-10-28",totalRows:69862,pricedOutcomeRows:69809,savedTimestampRows:69862});
 assert.equal(a.totalRows,69862);assert.equal(a.pricedOutcomeRows,69809);
 assert.equal(a.verifiedPredecisionCount,null);assert.equal(a.decision,"DO_NOT_PROMOTE");
 assert.equal(a.trainingEnabled,false);assert.equal(a.notificationsEnabled,false);
});
test("invalid totals and dates are rejected",()=>{
 const v={startDate:"2026-07-01",endDate:"2026-10-28",totalRows:10,pricedOutcomeRows:9,savedTimestampRows:10};
 assert.throws(()=>audit({...v,pricedOutcomeRows:11}),/INVALID_COVERAGE_COUNTS/);
 assert.throws(()=>audit({...v,startDate:"2026-02-30"}),/INVALID_DATE_RANGE/);
 assert.throws(()=>audit({...v,startDate:"2026-11-01"}),/INVALID_DATE_RANGE/);
});
test("empty input does not invent qualified observations",()=>{
 const a=audit({startDate:"2026-10-01",endDate:"2026-10-02",totalRows:0,pricedOutcomeRows:0,savedTimestampRows:0});
 assert.equal(a.outcomeCoverage,null);assert.equal(a.verifiedPredecisionCount,null);
});
