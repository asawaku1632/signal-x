import test from "node:test";
import assert from "node:assert/strict";
import {shapeReplayPolicy,shapeReferenceCandles,closedReferenceCandles} from "../../app/lib/research/shapeReplayTiming.mjs";
const bar=Date.parse("2026-11-06T15:30:00+09:00")/1000;
test("6678 evening snapshot includes completed Nov6 reference daily bar",()=>{const p=shapeReplayPolicy("2026-11-06T21:26:15+09:00",bar,"intraday");assert.equal(p.anchor,"2026-11-06");assert.equal(p.includeAnchor,true);assert.equal(p.sourceLabel,"5分足");});
test("morning scan excludes full detection-day daily candle",()=>{assert.equal(shapeReplayPolicy("2026-11-06T09:20:00+09:00",bar-6.25*3600,"intraday").includeAnchor,false);});
test("saved late with morning bar remains conservative",()=>{assert.equal(shapeReplayPolicy("2026-11-06T21:00:00+09:00",bar-6.25*3600,"intraday").includeAnchor,false);});
test("unknown and future bar times do not authorize same-day daily",()=>{assert.equal(shapeReplayPolicy("2026-11-06T21:00:00+09:00",null,"intraday").includeAnchor,false);assert.equal(shapeReplayPolicy("2026-11-06T09:00:00+09:00",bar,"intraday").includeAnchor,false);});
test("cutoff excludes later days and intraday current candle",()=>{const candles=[5,6,9].map(d=>({time:Date.parse("2026-11-"+String(d).padStart(2,"0")+"T09:00:00+09:00")/1000}));const p=shapeReplayPolicy("2026-11-06T21:26:15+09:00",bar,"intraday");assert.equal(shapeReferenceCandles(candles,p).length,2);assert.equal(closedReferenceCandles(candles,Date.parse("2026-11-09T10:00:00+09:00")).length,2);});
