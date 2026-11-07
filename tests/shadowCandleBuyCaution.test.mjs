import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  evaluateShadowBuyCaution,
  SHADOW_BUY_CAUTION_MIN_5D,
  SHADOW_BUY_CAUTION_MIN_STOCKS,
} from "../app/lib/research/shadowCandleBuyCaution.ts";

const read = p => readFileSync(new URL(`../${p}`, import.meta.url),"utf8");
const barTime = Date.parse("2026-11-06T06:00:00Z") / 1000;
const latest = {
  id:"SH_CDL_BEAR_HARAMI", name:"弱気のはらみ線", direction:"SELL",
  index:100,time:barTime,entryClose:125,location:"高値圏",
  reasons:["大陽線→小陰線","上昇圏"],
};
function stats({completed=115,codes=68,wins=75,winRate=65.22,meanReturn=0.72,patternId="SH_CDL_BEAR_HARAMI"}={}) {
  return [{
    patternId, name:"弱気のはらみ線", direction:"SELL",
    detections:118,codes,
    horizons:[{days:5,completed,wins,winRate,meanReturn,worstReturn:-11.43}],
  }];
}
function evaluate(hits=[latest], archiveRows=stats(), overrides={}) {
  return evaluateShadowBuyCaution({
    hits,latestCompletedBarTime:barTime,todayJst:"2026-11-08",
    archiveRows,...overrides,
  });
}

test("latest completed bearish harami with sufficiently broad historical evidence => caution, not trade ban", () => {
  const answer=evaluate();
  assert.equal(answer.level,"CAUTION");
  assert.equal(answer.signals.length,1);
  assert.equal(answer.signals[0].cautionQualified,true);
  assert.equal(answer.signals[0].directionMatchPercent,65.22);
  assert.equal(answer.signals[0].completed5d,115);
  assert.equal(answer.signals[0].distinctStocks,68);
  assert.equal(answer.signals[0].averagePriceChangePercent,-0.72);
  assert.equal(answer.signals[0].directionalWins,75);
  assert.ok(SHADOW_BUY_CAUTION_MIN_5D >= 60);
  assert.ok(SHADOW_BUY_CAUTION_MIN_STOCKS >= 25);
});

test("historical detection NOT on latest bar must NEVER generate current caution", () => {
  const older={...latest,index:98,time:barTime-2*86400};
  assert.equal(evaluate([older]).level,"NONE");
  assert.equal(evaluate([older]).signals.length,0);
});

test("bearish pattern name alone insufficient; low observed down-rate is only OBSERVE", () => {
  const weak={...latest,id:"SH_CDL_BEAR_ENGULF",name:"弱気のつつみ線"};
  const evidence=stats({patternId:"SH_CDL_BEAR_ENGULF",completed:81,codes:51,wins:41,winRate:50.62,meanReturn:.38});
  const result=evaluate([weak],evidence);
  assert.equal(result.level,"OBSERVE");
  assert.equal(result.signals[0].averagePriceChangePercent,-.38);
  assert.equal(result.signals[0].cautionQualified,false);
});

test("small/biased evidence never qualifies, even if retrospectively 100 percent", () => {
  for(const evidence of [
    stats({completed:4,codes:4,wins:4,winRate:100}),
    stats({completed:80,codes:3,wins:80,winRate:100}),
    stats({completed:80,codes:40,wins:50,winRate:62.5,meanReturn:-1.4}),
  ]) {
    const answer=evaluate([latest],evidence);
    assert.equal(answer.level,"OBSERVE");
    assert.equal(answer.signals[0].cautionQualified,false);
  }
});

test("stale/uncertain market data cannot show a current caution", () => {
  const stale=evaluate([latest],stats(),{todayJst:"2026-12-08"});
  assert.equal(stale.level,"STALE");
  assert.equal(stale.signals.length,0);
  const future=evaluate([latest],stats(),{todayJst:"2026-11-05"});
  assert.equal(future.level,"STALE");
});

test("missing archive cannot fabricate historical win rates, and BUY pattern is not bearish warning", () => {
  const unavailable=evaluate([latest],null);
  assert.equal(unavailable.level,"OBSERVE");
  assert.equal(unavailable.signals[0].directionMatchPercent,null);
  assert.equal(unavailable.signals[0].averagePriceChangePercent,null);
  assert.equal(evaluate([{...latest,id:"SH_CDL_BULL_HARAMI",direction:"BUY",name:"強気のはらみ線"}]).level,"NONE");
});

test("only owner, explicit valid one-code fetch; no production side effects", () => {
  const page=read("app/admin/shadow-candlestick-nine/page.tsx");
  assert.ok(page.indexOf("if (!isOwner) notFound()") < page.indexOf("await fetchOneDailyHistory(requested)"));
  assert.match(page,/validCode\s*\?\s*await fetchOneDailyHistory\(requested\)/);
  assert.match(page,/if \(validCode && !error && candles.length > 0\)/);
  assert.match(page,/combineArchivedShadowRuns\(archive.rows\)/);
  assert.match(page,/latestCompletedBarTime/);
  assert.match(page,/<ShadowBuyCautionPanel/);
  assert.doesNotMatch(page,/\b(?:INSERT|UPDATE|DELETE|sendLine|runScan|saveDailyStocks)\s*\(/);
  const panel=read("app/admin/shadow-candlestick-nine/ShadowBuyCautionPanel.tsx");
  assert.match(panel,/買う前の注意（研究用）/);
  assert.match(panel,/「買ってよい」という意味ではありません/);
  assert.match(panel,/AI POWER・買いランキング・通知・損切りルールは変更していません/);
  const policy=read("app/lib/research/shadowCandleBuyCaution.ts");
  assert.doesNotMatch(policy,/\b(?:fetch|pool\.query|INSERT|UPDATE|DELETE|sendLine|runScan)\s*\(/i);
});
