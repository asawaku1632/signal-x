import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";
import vm from "node:vm";

const source = readFileSync(new URL("../app/lib/research/marketIndexShadowContract.ts", import.meta.url), "utf8");
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const module = { exports: {} };
vm.runInNewContext(js, { module, exports: module.exports, Date, Intl, Number, String, Error });
const validate = module.exports.validateMarketIndexSnapshot;
const base = { index: "topix", value: 3000.5, observedAt: "2026-10-21T06:15:00Z", capturedAt: "2026-10-21T06:17:00Z", source: "synthetic-test" };
assert.equal(validate(base).status, "observed");
assert.equal(validate({ ...base, observedAt: null }).status, "missing");
assert.equal(validate({ ...base, value: 0 }).status, "invalid");
assert.equal(validate({ ...base, value: "3000" }).status, "invalid");
assert.equal(validate({ ...base, observedAt: "2026-10-21T05:00:00Z" }).status, "stale");
assert.equal(validate({ ...base, observedAt: "2026-10-20T06:15:00Z" }).status, "stale");
assert.equal(validate({ ...base, observedAt: "2026-10-21T06:25:00Z" }).status, "future_timestamp");
console.log("PASS: 7 market-index shadow contract checks");
