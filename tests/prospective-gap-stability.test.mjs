import test from "node:test";import assert from "node:assert/strict";
import {auditProspectiveGapStability as audit} from "../app/lib/research/prospectiveGapStability.mjs";
const report={daily:[{date:"2026-10-30",highCount:10,lowCount:20,gapPp:2},{date:"2026-11-02",highCount:12,lowCount:30,gapPp:-1},{date:"2026-11-04",highCount:12,lowCount:30,gapPp:-1}]};
test("reports mean median and leave-one-date-out",()=>{const x=audit(report);assert.equal(x.dates,3);assert.equal(x.meanGapPp,0);assert.equal(x.medianGapPp,-1);assert.deepEqual(x.leaveOneOutMeanRange,[-1,0.5]);assert.equal(x.deployable,false);});
test("isolated good day does not prove stability",()=>{const x=audit(report);assert.equal(x.positiveGapDates,1);assert.equal(x.status,"INSUFFICIENT_DATES");});
test("insufficient cohort sizes excluded",()=>assert.equal(audit({daily:[{date:"2026-10-30",highCount:9,lowCount:20,gapPp:20}]}).dates,0));
test("duplicate dates rejected",()=>assert.throws(()=>audit({daily:[report.daily[0],report.daily[0]]}),/DUPLICATE_DATE/));
test("not a decision engine",()=>{const x=audit(report,{minDays:2});assert.equal(x.status,"DESCRIPTIVE_ONLY");assert.equal(x.independentlyAuthenticated,false);assert.equal(x.deployable,false);});
test("invalid report rejected",()=>assert.throws(()=>audit({}),/INVALID_GAP_STABILITY_INPUT/));
