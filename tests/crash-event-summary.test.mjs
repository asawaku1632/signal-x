import test from "node:test";import assert from "node:assert/strict";
import {summarizeCrashByEvent as run} from "../app/lib/research/crashEventSummary.mjs";
const rows=[{eventDate:"2026-10-22",code:"1234",category:"REBOUND_WATCH",excessReturn:-1},{eventDate:"2026-10-22",code:"5678",category:"RESISTANCE",excessReturn:2}];
test("two categories on one day are only one event",()=>{const x=run(rows);assert.equal(x.independentDates,1);assert.equal(x.events.length,2);assert.equal(x.readyForTrading,false);});
test("duplicate excluded",()=>assert.equal(run([...rows,rows[0]]).duplicates,1));
test("invalid return excluded",()=>assert.equal(run([{...rows[0],excessReturn:NaN}]).invalid,1));
test("second distinct date adds an event",()=>assert.equal(run([...rows,{...rows[0],eventDate:"2026-10-23"}]).independentDates,2));
test("nonarray fails",()=>assert.throws(()=>run(null),/INVALID_CRASH_EVENT_ROWS/));
