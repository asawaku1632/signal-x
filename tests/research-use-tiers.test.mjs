import test from "node:test";
import assert from "node:assert/strict";
import {classifyResearchUse as run} from "../app/lib/research/researchUseTiers.mjs";
const base={price:100,nextPrice:101};
test("price pair is reference only",()=>assert.equal(run([base]).summary.referenceResearch,1));
test("missing price needs review",()=>assert.equal(run([{price:100}]).summary.needsReview,1));
test("linked source needs review",()=>assert.equal(run([{...base,sourceLinked:true}]).results[0].tier,"needsReview"));
test("all asserted evidence only strict candidate",()=>{const r=run([{...base,sourceLinked:true,priorAsOfDocumented:true,priorEvidenceVerified:true,outcomeProvenanceVerified:true}]);assert.equal(r.summary.strictCandidate,1);assert.equal(r.strictVerified,0);assert.equal(r.results[0].independentlyVerified,false);});
test("false provenance can't be promoted",()=>assert.equal(run([{...base,sourceLinked:true,priorAsOfDocumented:true,priorEvidenceVerified:false,outcomeProvenanceVerified:true}]).summary.strictCandidate,0));
test("zero price excluded",()=>assert.equal(run([{price:0,nextPrice:100}]).summary.needsReview,1));
test("null row handled",()=>assert.equal(run([null]).summary.needsReview,1));
test("invalid input rejected",()=>assert.throws(()=>run(null),/INVALID_RESEARCH_USE_ROWS/));
test("categories partition input",()=>{const r=run([base,{}, {...base,sourceLinked:true}]);assert.equal(Object.values(r.summary).reduce((a,b)=>a+b,0),3);});

test("missing next price is review, not silently omitted",()=>assert.equal(run([{price:100,nextPrice:null}]).summary.needsReview,1));
test("NaN price is review, not silently omitted",()=>assert.equal(run([{price:Number.NaN,nextPrice:101}]).summary.needsReview,1));
test("production-derived aggregate partition sums",()=>{const x=[58847,11436,1006];assert.equal(x.reduce((a,b)=>a+b,0),71289);});
