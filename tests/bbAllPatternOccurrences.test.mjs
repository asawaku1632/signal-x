import test from "node:test";
import assert from "node:assert/strict";
import {auditAllPatternOccurrences} from "../scripts/research/bb-all-pattern-occurrences.mjs";
const item=(code,date,patterns,after5dPct=null)=>({
 code,date,slot:"14:15",frozenAsOf:"14:10",priorMarket:"DOWN",
 patterns,after5dPct,worstDip5dPct:after5dPct===null?null:-1});
test("counts all signal observations before outcome selection",()=>{
 const rows=[item("8410","2026-11-04",["ENGULFING","MARUBOZU"],3.4),
  item("7203","2026-10-15",["ENGULFING","MARUBOZU"]),
  item("6326","2026-11-04",["MARUBOZU"],-3.5)];
 const r=auditAllPatternOccurrences(rows,{expected:3});
 assert.equal(r.total.observedEvents,3);
 assert.equal(r.combined.observedEvents,2);
 assert.equal(r.combined.pending5d,1);
 assert.equal(r.outsideNov4.observedEvents,1);
 assert.equal(r.eligibleForProduction,false);
});
test("duplicate event identity, unknown maturity and wrong time fail closed",()=>{
 const x=item("8410","2026-11-04",["ENGULFING","MARUBOZU"],3.4);
 assert.throws(()=>auditAllPatternOccurrences([x,x],{expected:2}),/INVALID_ALL_SIGNAL_EVENT/);
 assert.throws(()=>auditAllPatternOccurrences([{...x,frozenAsOf:"14:15"}],{expected:1}),/INVALID_ALL_SIGNAL_EVENT/);
 assert.throws(()=>auditAllPatternOccurrences([{...x,worstDip5dPct:null}],{expected:1}),/INVALID_ALL_SIGNAL_EVENT/);
});
