import test from "node:test";import assert from "node:assert/strict";
import {sealShadowScoreBatch as seal,inspectShadowScoreBatch as inspect} from "../app/lib/research/shadowScoreBatch.mjs";
const base={tradeDate:"2026-11-02",capturedAt:"2026-11-02T08:45:00+09:00",sourceId:"local-export",sourceVersion:"v1",baselineVersion:"b1",candidateVersion:"c1",rows:[{code:"7203",baselineScore:70,candidateScore:75},{code:"590A",baselineScore:65,candidateScore:80}]};
test("stable digest independent of row order",()=>{const a=seal(base),b=seal({...base,rows:[...base.rows].reverse()});assert.equal(a.digest,b.digest);assert.equal(inspect(a).intact,true);assert.equal(a.independentlyTimestamped,false);});
test("tampered score changes digest",()=>{const a=seal(base);assert.equal(inspect({...a,rows:[{...a.rows[0],candidateScore:99},a.rows[1]]}).intact,false);});
test("late snapshot blocked",()=>assert.throws(()=>seal({...base,capturedAt:"2026-11-02T09:06:00+09:00"}),/INVALID_SHADOW_BATCH/));
test("duplicate stock blocked",()=>assert.throws(()=>seal({...base,rows:[base.rows[0],base.rows[0]]}),/DUPLICATE/));
test("source version required",()=>assert.throws(()=>seal({...base,sourceVersion:""}),/INVALID_SHADOW_BATCH/));
test("external attestation never inferred",()=>assert.equal(inspect(seal(base)).independentlyTimestamped,false));
