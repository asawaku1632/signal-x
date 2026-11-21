import test from "node:test";
import assert from "node:assert/strict";
import {verifyAndReplay8053} from "../scripts/research/verify-bb-8053-overlap.mjs";
test("reject mismatched or absent capture before any result",()=>{
 assert.throws(()=>verifyAndReplay8053({},{}),/INVALID_8053_ARCHIVE/);
});
