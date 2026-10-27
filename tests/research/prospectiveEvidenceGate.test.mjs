import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";
import vm from "node:vm";

const source = readFileSync(new URL("../../app/lib/research/prospectiveEvidenceGate.ts", import.meta.url), "utf8");
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const context = { exports: {}, Intl, Date, Number };
vm.runInNewContext(js, context);
const classify = context.exports.classifyProspectiveEvidence;
const base = { signalObservedAt:"2026-10-27T00:15:00Z", priceObservedAt:"2026-10-27T00:14:30Z", capturedAt:"2026-10-27T00:15:05Z", provider:"LICENSED_PROVIDER", modelVersion:"RESEARCH_V1", signalDate:"2026-10-27", barEndAt:"2026-10-27T00:14:00Z" };
test("valid prospective metadata passes metadata gate only",()=>assert.equal(classify(base).eligible,true));
test("historical backfill is rejected",()=>assert.equal(classify({...base,capturedAt:"2026-10-28T00:15:05Z"}).reason,"NOT_CAPTURED_AT_SIGNAL_TIME"));
test("future quote is rejected",()=>assert.equal(classify({...base,priceObservedAt:"2026-10-27T00:16:00Z"}).reason,"FUTURE_PRICE_LEAKAGE"));
test("missing provider is rejected",()=>assert.equal(classify({...base,provider:null}).reason,"MISSING_PROVENANCE"));
test("missing timestamp is rejected",()=>assert.equal(classify({...base,barEndAt:null}).reason,"MISSING_OR_INVALID_TIMESTAMP"));
