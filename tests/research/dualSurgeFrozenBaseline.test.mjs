import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {checkBaselineManifest} from "../../app/lib/research/dualSurgeIntegrity.mjs";

const manifest=JSON.parse(readFileSync(new URL("../../docs/research/dual-surge-frozen-baseline-20261024.json",import.meta.url),"utf8"));
const checked=checkBaselineManifest(manifest);

test("frozen baseline event arithmetic balances",()=>assert.equal(checked.arithmetic.valid,true));
test("eligible stocks cannot exceed selected",()=>assert.equal(checked.eligibleNotMoreThanSelected,true));
test("frozen baseline does not claim event-level evidence",()=>assert.equal(checked.evidenceComplete,false));
test("frozen baseline has no event identity ledger",()=>assert.equal(checked.perEventSourcePresent,false));
test("frozen baseline disclaims unverified automated license",()=>assert.ok(manifest.limitations.some(x=>/license/i.test(x))));
test("frozen baseline rejects prospective win-rate claims",()=>assert.ok(manifest.notFor.includes("prospective win-rate claims")));
