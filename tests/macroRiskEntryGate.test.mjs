import test from "node:test";
import assert from "node:assert/strict";
import {assessMacroRisk, assessShortSwingPlan,checkMarketObservation} from "../app/lib/research/macroRiskEntryGate.mjs";
const asOf="2026-11-06T09:15:00+09:00";
const quote=(key,returnPct,overrides={})=>({key,returnPct,sessionDate:"2026-11-06",capturedAt:"2026-11-06T09:10:00+09:00",quoteStatus:"INTRADAY",sourceUrl:"https://example.org/quote",...overrides});
const stock=(pct,overrides={})=>({code:"3762",returnPct:pct,sessionDate:"2026-11-06",capturedAt:"2026-11-06T09:11:00+09:00",quoteStatus:"INTRADAY",sourceUrl:"https://example.org/stock",...overrides});
const plan={entryPrice:3100,stopPrice:3050,targetPrice:3200,shares:100,holdingSessions:3};

test("parallel JP market selloff pauses new buying independent of stock AI score",()=>{
  const r=assessMacroRisk({asOf,observations:[quote("NIKKEI",-2.2),quote("TOPIX",-2.1),quote("NASDAQ",-1)],tradePlan:plan});
  assert.equal(r.marketState,"PAUSE_NEW_BUYS_SHADOW");
  assert.ok(r.marketReasons.includes("JP_BREADTH_SELL_OFF"));
  assert.equal(r.planAssessment.status,"PLAN_STRUCTURALLY_OK");
  assert.equal(r.eligibleForTrading,false);
});
test("one very severe index triggers pause; a US shock alone can trigger pause",()=>{
  assert.equal(assessMacroRisk({asOf,observations:[quote("TOPIX",-3.1)]}).marketState,"PAUSE_NEW_BUYS_SHADOW");
  assert.ok(assessMacroRisk({asOf,observations:[quote("SOX",-5.2)]}).marketReasons.includes("SOX_SHOCK"));
});
test("missing context is not interpreted as a safe buy",()=>{
  const r=assessMacroRisk({asOf,observations:[quote("NIKKEI",0.2)]});
  assert.equal(r.marketState,"INSUFFICIENT_MARKET_EVIDENCE");
  assert.equal(r.suggestedNewEntryAction,"WAIT_FOR_DATA");
  assert.equal(r.eligibleForNotifications,false);
});
test("normal covered market does not imply a trading recommendation",()=>{
  const r=assessMacroRisk({asOf,observations:[quote("NIKKEI",-0.4),quote("TOPIX",-0.3),quote("NASDAQ",-0.2)]});
  assert.equal(r.marketState,"NO_CRASH_RULE_TRIGGERED");
  assert.equal(r.eligibleForTrading,false);
});
test("future and stale observations cannot be used",()=>{
  const r=assessMacroRisk({asOf,observations:[quote("NIKKEI",-4,{capturedAt:"2026-11-06T10:00:00+09:00"}),quote("TOPIX",-4,{capturedAt:"2026-10-29T09:10:00+09:00"})]});
  assert.equal(r.marketState,"INSUFFICIENT_MARKET_EVIDENCE");
  assert.equal(r.exclusions.length,2);
  assert.ok(r.exclusions[0].reasons.includes("FUTURE_CAPTURE"));
});
test("duplicate index quarantined; never choose favorable duplicate",()=>{
  const r=assessMacroRisk({asOf,observations:[quote("TOPIX",-4),quote("TOPIX",0),quote("NIKKEI",0),quote("NASDAQ",0)]});
  assert.equal(r.marketState,"INSUFFICIENT_MARKET_EVIDENCE");
  assert.ok(!r.usedIndices.includes("TOPIX"));
});
test("single-stock underperformance is distinguished from market-aligned decline",()=>{
  const base=[quote("NIKKEI",-3),quote("TOPIX",-3),quote("NASDAQ",-4)];
  const aligned=assessMacroRisk({asOf,observations:base,stock:stock(-3.5)}).stockAssessment;
  assert.equal(aligned.status,"BROAD_SELL_OFF_ALIGNED");
  assert.equal(aligned.excessVsTopixPct,-0.5);
  const weak=assessMacroRisk({asOf,observations:base,stock:stock(-6.2)}).stockAssessment;
  assert.equal(weak.status,"STOCK_UNDERPERFORMING_MARKET");
  assert.equal(weak.excessVsTopixPct,-3.2);
});
test("previous-day TOPIX cannot be compared to today's stock",()=>{
  const r=assessMacroRisk({asOf,observations:[quote("TOPIX",-3,{sessionDate:"2026-11-05",quoteStatus:"CLOSED"})],stock:stock(-5)});
  assert.equal(r.stockAssessment.status,"UNKNOWN");
});
test("future stock observation and missing source are not permitted",()=>{
  const r=assessMacroRisk({asOf,observations:[quote("TOPIX",-3)],stock:stock(-5,{capturedAt:"2026-11-06T11:00:00+09:00"})});
  assert.equal(r.stockAssessment.status,"UNKNOWN");
  assert.equal(checkMarketObservation(quote("NIKKEI",-5,{sourceUrl:""}),asOf).valid,false);
});
test("3-5-session plan computes risk and reward; stop is not guaranteed",()=>{
  const result=assessShortSwingPlan(plan);
  assert.equal(result.riskYen,5000);
  assert.equal(result.targetProfitYen,10000);
  assert.equal(result.rewardRiskRatio,2);
  assert.match(result.stopCaution,/not a hard cap/);
});
test("violated 10000-yen risk budget does not pass despite attractive target",()=>{
  const result=assessShortSwingPlan({...plan,stopPrice:2950,targetPrice:3400});
  assert.equal(result.status,"REVIEW_LOSS_CAP");
  assert.equal(result.riskYen,15000);
});
test("weak risk reward and missing stops are explicit",()=>{
  assert.equal(assessShortSwingPlan({...plan,targetPrice:3140}).status,"REVIEW_WEAK_REWARD_RISK");
  assert.equal(assessShortSwingPlan({...plan,stopPrice:null}).status,"INVALID_PLAN");
  assert.equal(assessShortSwingPlan({...plan,holdingSessions:8}).status,"INVALID_PLAN");
  assert.equal(assessShortSwingPlan(null).status,"MISSING_PLAN");
});
test("as-of is required for auditability",()=>assert.throws(()=>assessMacroRisk({asOf:"2026-11-06"}),/INVALID_AS_OF_TIMESTAMP/));
test("mixed JP sessions cannot be treated as breadth confirmation",()=>{
  const r=assessMacroRisk({asOf,observations:[quote("NIKKEI",-1.8),quote("TOPIX",-1.9,{sessionDate:"2026-11-05",quoteStatus:"CLOSED"}),quote("NASDAQ",0)]});
  assert.equal(r.japanCovered,false);
  assert.equal(r.marketState,"INSUFFICIENT_MARKET_EVIDENCE");
  assert.ok(!r.marketReasons.includes("JP_BREADTH_SELL_OFF"));
});
test("sub-yen theoretical risk cannot yield infinite reward-risk",()=>{
  assert.equal(assessShortSwingPlan({entryPrice:1,stopPrice:0.999999,targetPrice:2,shares:1,holdingSessions:3}).status,"INVALID_PLAN");
});
