import test from "node:test";
import assert from "node:assert/strict";
import { assessForwardExperimentRisk } from "../app/lib/research/dailyForwardExperimentRisk.mjs";
const trades=Array.from({length:30},(_,i)=>({
 id:`T${i}`,startDate:`2026-${String(Math.floor(i/15)+1).padStart(2,"0")}-${String(i%15+1).padStart(2,"0")}`,
 endDate:`2026-${String(Math.floor(i/15)+1).padStart(2,"0")}-${String(i%15+1).padStart(2,"0")}`,
 grossReturnPct:1,verified:true,
}));
test("non-overlapping verified trades yield cost-adjusted descriptive risk only",()=>{
 const result=assessForwardExperimentRisk(trades);
 assert.equal(result.status,"DESCRIPTIVE_RISK_ONLY");
 assert.ok(Math.abs(result.averageNetReturnPct-0.7)<1e-10);
 assert.equal(result.improvementProven,false);
 assert.equal(result.autoApply,false);
});
test("unverified trade blocks risk reporting",()=>{
 const changed=trades.map(t=>({...t}));changed[2].verified=false;
 assert.equal(assessForwardExperimentRisk(changed).status,"RISK_REVIEW_BLOCKED");
});
test("overlapping trade dates are blocked",()=>{
 const changed=trades.map(t=>({...t}));changed[1].startDate=changed[0].startDate;
 assert.ok(assessForwardExperimentRisk(changed).reasons.includes("OVERLAPPING_OR_UNSORTED_TRADES"));
});
test("costs can turn positive gross returns into net losses",()=>{
 const result=assessForwardExperimentRisk(trades,{roundTripCostPct:2});
 assert.equal(result.status,"RISK_REVIEW_BLOCKED");
 assert.ok(result.reasons.includes("DRAWDOWN_LIMIT_EXCEEDED"));
});
