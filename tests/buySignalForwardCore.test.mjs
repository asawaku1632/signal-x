import test from "node:test";
import assert from "node:assert/strict";
import { evaluateBuySignalForward } from "../app/lib/research/buySignalForwardCore.mjs";

const dates = Array.from({length:20},(_,i)=>`2026-10-${String(i+1).padStart(2,"0")}`);
const base = { signalPrice: 100, signalDate:"2026-09-30", tradingDates:dates };
const bar=(index,close,verified=true)=>({tradeDate:dates[index],close,verified,corporateActionAdjusted:true});
test("evaluates exact horizons and first close recovery",()=>{
  const result=evaluateBuySignalForward({...base,observations:dates.map((_,i)=>bar(i,i===0?95:i===1?99:105))});
  assert.ok(Math.abs(result.outcomes[0].returnPct + 5) < 1e-9);
  assert.ok(Math.abs(result.outcomes[1].returnPct - 5) < 1e-9);
  assert.equal(result.outcomes[4].horizon,20);
  assert.equal(result.firstCloseRecoverySession,3);
  assert.equal(result.worstCloseDrawdownPct,-5);
});
test("never fills missing or unverified outcomes",()=>{
  const result=evaluateBuySignalForward({...base,observations:[bar(0,95),bar(4,120,false)]});
  assert.equal(result.outcomes[2].status,"UNVERIFIED");
  assert.equal(result.outcomes[2].returnPct,null);
  assert.equal(result.firstCloseRecoverySession,null);
});
test("rejects duplicate observations",()=>{
  assert.throws(()=>evaluateBuySignalForward({...base,observations:[bar(0,90),bar(0,95)]}),/DUPLICATE/);
});
test("rejects invalid prices and unordered dates",()=>{
  assert.throws(()=>evaluateBuySignalForward({...base,signalPrice:0,observations:[]}),/INVALID_SIGNAL/);
  assert.throws(()=>evaluateBuySignalForward({...base,tradingDates:[dates[1],dates[0]],observations:[]}),/INVALID_TRADING/);
});
