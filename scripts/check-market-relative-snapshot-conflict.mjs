import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";
const source=fs.readFileSync("app/lib/research/marketRelativeSnapshotConflict.ts","utf8");
const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
const exports={};
vm.runInNewContext(js,{exports,Number,Date});
const decide=exports.classifySnapshotConflict;
const input={signalId:"sig-1",code:"9684",aiPower:93,price:3000,priceObservedAt:"2026-10-21T09:05:00+09:00",signalObservedAt:"2026-10-21T09:05:10+09:00",capturedAt:"2026-10-21T09:05:15+09:00",source:"synthetic",version:"v1"};
const stored={signal_id:"sig-1",code:"9684",ai_power:"93",price:"3000.0",price_observed_at:"2026-10-21T00:05:00Z",signal_observed_at:"2026-10-21T00:05:10Z",captured_at:"2026-10-21T00:05:15Z",source:"synthetic",version:"v1"};
const cases=[
 [[stored],"duplicate"],
 [[], "missing"],
 [[stored,stored],"conflict"],
 [[{...stored,ai_power:"10"}],"conflict"],
 [[{...stored,price:"3100"}],"conflict"],
 [[{...stored,source:"other"}],"conflict"],
 [[{...stored,version:"v2"}],"conflict"],
 [[{...stored,captured_at:"2026-10-21T00:06:15Z"}],"conflict"],
 [[{...stored,ai_power:null}],"conflict"]
];
for(const [rows,expected] of cases) assert.equal(decide(input,rows),expected);
console.log("PASS: "+cases.length+" snapshot retry/conflict checks");
