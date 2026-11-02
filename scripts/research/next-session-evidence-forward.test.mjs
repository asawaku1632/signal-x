import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {assessAsOfCatalysts,assessFrozenBudgetMorning} from "../../app/lib/research/nextSessionCatalystAudit.mjs";
import {summarizeFrozenBudgetOutcomes,MIN_FORWARD_STOCK_DAYS,MIN_FORWARD_TRADE_DAYS} from "../../app/lib/research/nextSessionBudgetForward.mjs";
import {holdingTradingDates} from "../../app/lib/research/nightTimingHolding.mjs";
import {isTseTradingDate} from "../../app/lib/technicalObservation/tseMarketCalendar.ts";

const evidence={
  code:"5333",type:"UPWARD_REVISION",title:"通期利益予想の上方修正",
  publishedAt:"2026-10-30T15:40:00+09:00",
  observedAt:"2026-10-30T15:46:00+09:00",
  sourceUrl:"https://example.co.jp/ir/20261030",
};
const freezeAt="2026-11-02T18:10:00+09:00";
test("a timestamp-eligible IR record still needs independent content review",()=>{
  const r=assessAsOfCatalysts({code:"5333",freezeAt,records:[evidence,evidence]});
  assert.equal(r.status,"TIMING_ELIGIBLE_ONLY");assert.equal(r.accepted.length,1);
  assert.equal(r.accepted[0].publishedAt,evidence.publishedAt);
});
test("a later press release is excluded from an earlier frozen shortlist",()=>{
  const r=assessAsOfCatalysts({code:"5333",freezeAt:"2026-10-30T15:30:00+09:00",records:[evidence]});
  assert.equal(r.status,"NOT_VERIFIED");assert.equal(r.afterFreeze,1);
});
test("publication in time but observation after freeze is hindsight",()=>{
  const r=assessAsOfCatalysts({code:"5333",freezeAt,records:[{...evidence,observedAt:"2026-11-04T09:10:00+09:00"}]});
  assert.equal(r.accepted.length,0);assert.equal(r.afterFreeze,1);
});
test("wrong stock, unsafe source and missing timezone are never verified",()=>{
  const records=[{...evidence,code:"8316"},{...evidence,sourceUrl:"http://example.com"},
    {...evidence,publishedAt:"2026-10-30T15:40:00"},{...evidence,title:""}];
  const r=assessAsOfCatalysts({code:"5333",freezeAt,records});
  assert.equal(r.status,"NOT_VERIFIED");assert.equal(r.rejected,4);
});
test("never assert a catalyst from an empty feed",()=>{
  assert.equal(assessAsOfCatalysts({code:"5333",freezeAt,records:[]}).status,"NOT_VERIFIED");
});
const stock={code:"8316",name:"三井住友FG",score:92,referencePrice:3150,
  referencePriceDate:"2026-11-02",targetTradeDate:"2026-11-04",
  budgetYen:350000,shares:100};
const frozen={
  trade_date:"2026-11-04",prior_date:"2026-11-02",
  frozen_at:"2026-11-02 09:10:00+00",cohort:[
    {code:"8316",name:"三井住友FG",score:92,referencePrice:3150}],
  morning_state:"COMPLETE",morning_saved_at:"2026-11-04 00:08:00+00",
  morning_observations:[{code:"8316",priorScore:92,priorReferencePrice:3150,
    label:"BUY_CANDIDATE",price0905:3210}],
};
test("9:05 matches actual archived night freeze even with PG timezone text",()=>{
  const r=assessFrozenBudgetMorning(stock,frozen);
  assert.equal(r.status,"RESEARCH_CONDITION");assert.equal(r.referenceCostYen,321000);
});
test("a budget compliant at night can fail budget after opening gap",()=>{
  const r=assessFrozenBudgetMorning(stock,{...frozen,
    morning_observations:[{...frozen.morning_observations[0],price0905:3600}]});
  assert.equal(r.status,"OVER_BUDGET");
});
test("even a perfectly frozen candidate is blocked when prior-night budget is too small",()=>{
  assert.equal(assessFrozenBudgetMorning({...stock,budgetYen:300000},frozen).status,"PRIOR_BUDGET_FAIL");
});
test("unfrozen row, mismatched score, missing bar and late saved morning fail closed",()=>{
  assert.equal(assessFrozenBudgetMorning(stock,null).status,"NOT_FROZEN");
  assert.equal(assessFrozenBudgetMorning(stock,{...frozen,frozen_at:"2026-11-04 00:10:00+00"}).status,"NOT_FROZEN");
  assert.equal(assessFrozenBudgetMorning(stock,{...frozen,cohort:[{...frozen.cohort[0],score:100}]}).status,"NOT_FROZEN");
  assert.equal(assessFrozenBudgetMorning(stock,{...frozen,morning_saved_at:"2026-11-04 00:20:00+00"}).status,"MORNING_UNVERIFIED");
  assert.equal(assessFrozenBudgetMorning(stock,{...frozen,morning_observations:[]}).status,"MORNING_UNVERIFIED");
});
test("CAUTION or SKIP never masquerades as a verified buy",()=>{
  const r=assessFrozenBudgetMorning(stock,{...frozen,
    morning_observations:[{...frozen.morning_observations[0],label:"SKIP"}]});
  assert.equal(r.status,"RESEARCH_WAIT");
});
const sample={
  date:"2026-10-22",code:"8316",freezeAt:"2026-10-21T09:10:00Z",
  entries:{PREVIOUS_REFERENCE:3100,"09:05":3200,"09:30":3250},morningGate:"BUY_CANDIDATE",
  targetDates:{1:"2026-10-23",3:"2026-10-27",5:"2026-10-29"},
  exits:{1:3260,3:3290,5:3330},
};
test("one frozen candidate: target is mathematical outcome, not a predicted win",()=>{
  const x=summarizeFrozenBudgetOutcomes([sample],{budgetYen:350000,asOfDate:"2026-11-02"});
  assert.equal(x.frozenEligible,1);assert.equal(x.horizons[0].wins,1);
  assert.equal(x.horizons[0].targetHits,0);
  assert.equal(x.horizons[1].targetHits,0);
  assert.equal(x.horizons[2].targetHits,1);
  assert.equal(x.horizons[0].positiveRate,null);
  assert.equal(x.status,"INSUFFICIENT_HISTORY");
});
test("horizon not matured or missing future price remains unscored",()=>{
  const x=summarizeFrozenBudgetOutcomes([{
    ...sample,targetDates:{1:"2026-10-23",3:"2026-11-04",5:"2026-11-09"},
    exits:{1:null,3:3900,5:4500},
  }],{budgetYen:350000,asOfDate:"2026-11-02"});
  assert.equal(x.horizons[0].missing,1);
  assert.equal(x.horizons[1].checked,0);assert.equal(x.horizons[2].checked,0);
});
test("a 9:05 price over budget cannot be counted as an achieved win",()=>{
  const x=summarizeFrozenBudgetOutcomes([{...sample,entries:{PREVIOUS_REFERENCE:3100,"09:05":3300,"09:30":3600},
    exits:{1:4000,3:4500,5:4700}}],
  {budgetYen:350000,asOfDate:"2026-11-02"});
  assert.equal(x.overBudget,1);assert.equal(x.eligible,0);
});
test("unfrozen outcomes, caution labels and duplicates cannot create trade returns",()=>{
  const x=summarizeFrozenBudgetOutcomes([
    {...sample,morningGate:"CAUTION"},
    {...sample,code:"5333",freezeAt:"2026-10-22T01:00:00Z"},
    {...sample},
  ],{budgetYen:350000,asOfDate:"2026-11-02"});
  assert.equal(x.eligible,0);assert.equal(x.gateRejected,1);
});
test("no profitable 09:05 fill after a later saved 09:08 decision",()=>{
  // Earlier indicative 09:05 price 3200 would show +6000 yen, but
  // actual analysis was not saved until 09:08, and 09:30 may be higher.
  const row={...sample,entries:{...sample.entries,"09:30":3350}};
  const x=summarizeFrozenBudgetOutcomes([row],{budgetYen:350000,asOfDate:"2026-11-02"});
  assert.equal(x.horizons[0].wins,0);
  assert.equal(x.horizons[0].lossThresholdBreaches,0);
});

test("actual JPX trading calendar skips 2026-11-03 for forward milestones",()=>{
  assert.equal(isTseTradingDate("2026-11-03"),false);
  const t=holdingTradingDates("2026-11-02",isTseTradingDate);
  assert.equal(t[1],"2026-11-04");
  assert.equal(t[3],"2026-11-06");
  assert.equal(t[5],"2026-11-10");
});
test("full statistical output only after 30 distinct stock-days over ten sessions",()=>{
  const days=["2026-09-28","2026-09-29","2026-09-30","2026-10-01",
    "2026-10-02","2026-10-05","2026-10-06","2026-10-07",
    "2026-10-08","2026-10-09"];
  const rows=days.flatMap(date=>["1001","1002","1003"].map(code=>({
    ...sample,date,code,freezeAt:new Date(Date.parse(date+"T00:00:00Z")-14*60*60*1000).toISOString(),
    targetDates:holdingTradingDates(date,isTseTradingDate),
  })));
  const x=summarizeFrozenBudgetOutcomes(rows,{budgetYen:350000,asOfDate:"2026-11-02"});
  assert.equal(rows.length,MIN_FORWARD_STOCK_DAYS);
  assert.equal(days.length,MIN_FORWARD_TRADE_DAYS);
  assert.equal(x.horizons[0].checked,30);
  assert.equal(x.horizons[0].positiveRate,100);
  assert.equal(x.horizons[0].avgPnl100,1000);
  assert.equal(x.horizons[1].targetHitRate,0);
  assert.equal(x.horizons[2].targetHitRate,100);
  assert.equal(x.horizons[2].medianPnl100,8000);
});
test("outcomes cannot influence frozen shortlist rank or the as-of catalyst evidence",()=>{
  const base={code:"5333",freezeAt,records:[evidence]};
  const before=assessAsOfCatalysts(base);
  const after=assessAsOfCatalysts({...base,records:[{...evidence,result_5d:999}]});
  assert.deepEqual(before,after);
});
test("invalid as-of day is rejected, not silently repaired",()=>{
  assert.throws(()=>summarizeFrozenBudgetOutcomes([sample],{budgetYen:350000,asOfDate:"2026-11-31"}));
});
test("owner-only budget page and existing frozen study are linked without notifications",()=>{
  const page=readFileSync("app/admin/night-morning-watch/page.tsx","utf8");
  const holdings=readFileSync("app/admin/night-entry-holding/page.tsx","utf8");
  assert.match(page,/assessFrozenBudgetMorning/);
  assert.match(page,/getLearningOwnerSession/);
  assert.match(holdings,/summarizeFrozenBudgetOutcomes/);
  assert.match(holdings,/\bMIN_FORWARD_STOCK_DAYS\b|最低30件/);
  assert.doesNotMatch(page,/sendNotification\(/);
});
