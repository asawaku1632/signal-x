import assert from "node:assert/strict";
import test from "node:test";
import {readFileSync} from "node:fs";
import ts from "typescript";

// Compile only the pure metadata module in memory. No provider calls or DB access.
const file = new URL("../app/lib/research/morningQuoteMetadata.ts", import.meta.url);
const source = readFileSync(file, "utf8");
const compiled = ts.transpileModule(source, {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const mod = {exports:{}};
new Function("module","exports",compiled)(mod,mod.exports);
const {classifyFiveMinuteMetadata: classify} = mod.exports;
const epoch = (hour, minute) => Math.floor(Date.parse(`2026-10-26T${String(hour).padStart(2,"0")}:${String(minute).padStart(2,"0")}:00+09:00`) / 1000);
const chart = timestamps => ({chart:{result:[{timestamp:timestamps,indicators:{quote:[{}]}}],error:null}});

test("non-2xx HTTP remains unavailable",()=>assert.equal(classify({},429,"2026-10-26").reason,"UPSTREAM_HTTP_ERROR"));
test("chart provider error",()=>assert.equal(classify({chart:{error:{code:"rate_limit"},result:null}},200,"2026-10-26").reason,"PROVIDER_CHART_ERROR"));
test("missing result",()=>assert.equal(classify({chart:{result:null}},200,"2026-10-26").reason,"NO_RESULT"));
test("missing timestamp array",()=>assert.equal(classify({chart:{result:[{indicators:{quote:[{}]}}]}},200,"2026-10-26").reason,"NO_TIMESTAMP_ARRAY"));
test("missing quote array",()=>assert.equal(classify({chart:{result:[{timestamp:[]}]}},200,"2026-10-26").reason,"NO_QUOTE_ARRAY"));
test("missing 09:00",()=>assert.equal(classify(chart([epoch(9,5)]),200,"2026-10-26").reason,"MISSING_0900_BAR"));
test("missing 09:05",()=>assert.equal(classify(chart([epoch(9,0)]),200,"2026-10-26").reason,"MISSING_0905_BAR"));
test("both present does not claim valid prices",()=>{
  const result=classify(chart([epoch(9,0),epoch(9,5)]),200,"2026-10-26");
  assert.equal(result.reason,"BARS_PRESENT_NOT_PRICE_VALIDATED");
  assert.equal(result.has0905,true);
  assert.equal("price" in result,false);
});
