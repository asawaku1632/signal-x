import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import test from "node:test";
import {evaluateNanpinResearch} from "../app/lib/nanpinResearch.ts";

const input = {
  entryPrice: 1000, addPrice: 800, initialCost: 100000, additionalCost: 80000,
  referencePrice: 800, snapshotUpdatedAt: new Date(Date.now()-120000).toISOString(),
  snapshotStale: false, aiPower: 90, rsi: 51, changePercent: 1.1, volumeRatio: 1.4, stopLoss: 700,
};

test("complete fresh indicators produce observation ONLY, never purchase advice", () => {
  const r = evaluateNanpinResearch(input);
  assert.equal(r.status, "WATCH");
  assert.match(r.explanation, /買い推奨ではなく/);
  assert.ok(r.reasons.some(x=>x.includes("80%")));
});
test("sharp drop or existing stop line blocks observation", () => {
  assert.equal(evaluateNanpinResearch({...input,changePercent:-4}).status,"RISK");
  assert.equal(evaluateNanpinResearch({...input,stopLoss:850}).status,"RISK");
  assert.equal(evaluateNanpinResearch({...input,aiPower:40}).status,"RISK");
});
test("uncertain cases refuse to rank or promise rebound", () => {
  assert.equal(evaluateNanpinResearch({...input,snapshotStale:true}).status,"NO_DATA");
  assert.equal(evaluateNanpinResearch({...input,snapshotUpdatedAt:null}).status,"NO_DATA");
  assert.equal(evaluateNanpinResearch({...input,referencePrice:null}).status,"NO_DATA");
  assert.equal(evaluateNanpinResearch({...input,referencePrice:900}).status,"NO_DATA");
  assert.equal(evaluateNanpinResearch({...input,rsi:null}).status,"NO_DATA");
  assert.equal(evaluateNanpinResearch({...input,addPrice:1100}).status,"NOT_NANPIN");
  assert.equal(evaluateNanpinResearch({...input,volumeRatio:0.8}).status,"WAIT");
});
test("glossary teaches the numerical example and directs to the calculator", () => {
  const glossary=readFileSync("app/glossary/page.tsx","utf8");
  assert.match(glossary,/id:"nanpin"/);
  assert.match(glossary,/1,000円/);
  assert.match(glossary,/900円/);
  assert.match(glossary,/\/simulation\/nanpin/);
});
test("research screen remains GET-only, no signal, trade or learning mutations", () => {
  const page=readFileSync("app/simulation/nanpin/page.tsx","utf8");
  const lib=readFileSync("app/lib/nanpinResearch.ts","utf8");
  assert.match(page,/evaluateNanpinResearch/);
  assert.match(page,/snapshotUpdatedAt/);
  assert.match(page,/snapshotStale/);
  assert.doesNotMatch(page,/method:\s*["'](?:POST|PUT|PATCH|DELETE)["']/);
  assert.doesNotMatch(page+lib, /\/api\/cron|INSERT INTO|UPDATE public\.|sendLine|notifyMomentum/);
});
