import test from "node:test";
import assert from "node:assert/strict";
import {researchPriorScoreDailyGaps as run} from "../app/lib/research/priorScoreRobustness.mjs";
const make=(date,code,priorScore,nextPrice=101,extra={})=>({
 date,code,priorDate:"2026-10-28",priorScore,priorEvidenceVerified:true,
 price:100,nextPrice,outcomeDate:"2026-11-03",outcomeProvenanceVerified:true,...extra
});
const sample=[
 make("2026-10-30","1234",90,105),make("2026-10-30","1235",50,101),
 make("2026-11-02","1234",90,98),make("2026-11-02","1235",50,99)
];
test("one-day positive gap",()=>{const x=run(sample.slice(0,2),{minPerGroup:1});assert.equal(x.days,1);assert.equal(x.meanGap,4);});
test("two-day equal-date mean",()=>{const x=run(sample,{minPerGroup:1});assert.equal(x.days,2);assert.equal(x.meanGap,1.5);});
test("median",()=>assert.equal(run(sample,{minPerGroup:1}).medianGap,1.5));
test("per-group counts",()=>{const x=run(sample,{minPerGroup:1});assert.equal(x.highRows,2);assert.equal(x.lowRows,2);});
test("positive days",()=>assert.equal(run(sample,{minPerGroup:1}).positiveGapDays,1));
test("regime up from full-day return",()=>assert.equal(run(sample,{minPerGroup:1}).regimes.UP.days,1));
test("regime down from full-day return",()=>assert.equal(run(sample,{minPerGroup:1}).regimes.DOWN.days,1));
test("regime flat empty",()=>assert.equal(run(sample,{minPerGroup:1}).regimes.FLAT.days,0));
test("clipping",()=>assert.equal(run([make("2026-10-30","1234",90,120),make("2026-10-30","1235",50,100)],{minPerGroup:1}).clippedMeanGap,5));
test("remove one extreme",()=>assert.equal(run(sample,{minPerGroup:1,omitExtremeDates:1}).remainingDays,1));
test("remove all extremes yields null",()=>assert.equal(run(sample,{minPerGroup:1,omitExtremeDates:10}).afterExtremeMeanGap,null));
test("code coverage",()=>assert.equal(run(sample,{minPerGroup:1}).codeCount,1));
test("top10 count",()=>assert.equal(run(sample,{minPerGroup:1}).top10Observations,2));
test("no rows",()=>{const x=run([]);assert.equal(x.days,0);assert.equal(x.meanGap,null);});
test("minPerGroup default suppresses tiny groups",()=>assert.equal(run(sample).days,0));
test("invalid options min",()=>assert.throws(()=>run([],{minPerGroup:0}),/INVALID_DAILY_GAP_OPTIONS/));
test("invalid options clip",()=>assert.throws(()=>run([],{clipPct:-1}),/INVALID_DAILY_GAP_OPTIONS/));
test("invalid options omitted",()=>assert.throws(()=>run([],{omitExtremeDates:-1}),/INVALID_DAILY_GAP_OPTIONS/));
test("invalid options start date",()=>assert.throws(()=>run([],{startDate:"2026-02-30"}),/INVALID_DAILY_GAP_OPTIONS/));
test("reject non-array input",()=>assert.throws(()=>run(null),/INVALID_DAILY_GAP_OPTIONS/));
test("earlier dates excluded",()=>assert.equal(run(sample,{startDate:"2026-11-02",minPerGroup:1}).excluded.beforeStart,2));
test("duplicate row excluded",()=>assert.equal(run([...sample,sample[0]],{minPerGroup:1}).excluded.duplicate,1));
test("missing prior evidence excluded",()=>assert.equal(run([make("2026-10-30","1234",90,105,{priorEvidenceVerified:false})],{minPerGroup:1}).excluded.missingPriorEvidence,1));
test("same-date prior rejected",()=>assert.equal(run([make("2026-10-30","1234",90,105,{priorDate:"2026-10-30"})],{minPerGroup:1}).excluded.missingPriorEvidence,1));
test("future prior date rejected",()=>assert.equal(run([make("2026-10-30","1234",90,105,{priorDate:"2026-11-01"})],{minPerGroup:1}).excluded.missingPriorEvidence,1));
test("unverified outcome excluded",()=>assert.equal(run([make("2026-10-30","1234",90,105,{outcomeProvenanceVerified:false})],{minPerGroup:1}).excluded.missingOutcome,1));
test("same date outcome rejected",()=>assert.equal(run([make("2026-10-30","1234",90,105,{outcomeDate:"2026-10-30"})],{minPerGroup:1}).excluded.missingOutcome,1));
test("nonpositive price excluded",()=>assert.equal(run([make("2026-10-30","1234",90,105,{price:0})],{minPerGroup:1}).excluded.missingOutcome,1));
test("nonpositive next price excluded",()=>assert.equal(run([make("2026-10-30","1234",90,0)],{minPerGroup:1}).excluded.missingOutcome,1));
test("bad code excluded",()=>assert.equal(run([make("2026-10-30","x",90)],{minPerGroup:1}).excluded.invalid,1));
test("invalid date excluded",()=>assert.equal(run([make("2026-02-30","1234",90)],{minPerGroup:1}).excluded.invalid,1));
test("no actionable prediction",()=>{const x=run(sample,{minPerGroup:1});assert.equal(x.shadowOnly,true);assert.match(x.warning,/No live signal/);});
test("score exactly 85 high",()=>assert.equal(run([make("2026-10-30","1234",85),make("2026-10-30","1235",84)],{minPerGroup:1}).highRows,1));
test("missing prior score excluded",()=>assert.equal(run([make("2026-10-30","1234",null)],{minPerGroup:1}).excluded.missingPriorEvidence,1));
