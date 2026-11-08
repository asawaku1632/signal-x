import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { getShadowNineQuickVerdict } from "../app/lib/research/shadowCandleQuickVerdict.ts";

const read = path => readFileSync(new URL(`../${path}`,import.meta.url),"utf8");
const moment = Date.parse("2026-11-06T06:00:00Z")/1000;
const bull={ id:"SH_CDL_BULL_HARAMI",name:"強気のはらみ線",direction:"BUY",index:14,
  time:moment,entryClose:100,location:"安値圏",reasons:["形状"] };
const bear={ ...bull,id:"SH_CDL_BEAR_HARAMI",name:"弱気のはらみ線",
  direction:"SELL",location:"高値圏" };
const base = { status:"NO_BEARISH",heading:"買い判断は保留",explanation:"直近の下落形状なし",
  hitCount:5,detectedTypes:2,recentBarSignals:0,completedFiveDay:4,totalFiveDay:5,
  mostRecentHits:[bull],mostRecentDate:"2026-11-05",sessionsSinceLastHit:1,
  fiveDayPendingForMostRecent:true };

test("unloaded/error state never labels buy/sell by guesswork",()=>{
  assert.equal(getShadowNineQuickVerdict(null).label,"判定中");
  assert.equal(getShadowNineQuickVerdict(null,true).label,"判定不可");
});

test("the 9682-like example: historic bull harami, no latest signal => 静観, not buy",()=>{
  const tag=getShadowNineQuickVerdict(base);
  assert.equal(tag.label,"静観");
  assert.equal(tag.tone,"neutral");
  assert.doesNotMatch(tag.explanation,/買い推奨/);
});

test("bullish only on current completed daily bar => pattern label only, never buy recommendation",()=>{
  const tag=getShadowNineQuickVerdict({...base,sessionsSinceLastHit:0,recentBarSignals:1});
  assert.equal(tag.label,"買い形状あり");
  assert.equal(tag.tone,"green");
  assert.match(tag.explanation,/買い推奨.*意味ではありません/);
});

test("bearish caution has priority, but it is not a direct sell order",()=>{
  const tag=getShadowNineQuickVerdict({...base,status:"CAUTION",mostRecentHits:[bear],
    sessionsSinceLastHit:0,recentBarSignals:1});
  assert.equal(tag.label,"売り警戒");
  assert.equal(tag.tone,"red");
  assert.match(tag.explanation,/売却推奨ではありません/);
  const observe=getShadowNineQuickVerdict({...base,status:"WATCH",mostRecentHits:[bear],
    sessionsSinceLastHit:0,recentBarSignals:1});
  assert.equal(observe.label,"下落注意");
});

test("mixed opposing shapes must force watch, and old signals never appear current",()=>{
  const both=getShadowNineQuickVerdict({...base,status:"WATCH",mostRecentHits:[bull,bear],
    sessionsSinceLastHit:0,recentBarSignals:2});
  assert.equal(both.label,"売買混在・静観");
  const old=getShadowNineQuickVerdict({...base,status:"NO_BEARISH",mostRecentHits:[bear],
    sessionsSinceLastHit:3,recentBarSignals:0});
  assert.equal(old.label,"静観");
  const stale=getShadowNineQuickVerdict({...base,status:"STALE"});
  assert.equal(stale.label,"更新待ち");
});

test("owner-only render autoloads exactly once per mount and exposes verdict before expansion",()=>{
  const component=read("app/components/analysis/OwnerCandleNineSummary.tsx");
  const render=component.indexOf("return (\n    <details");
  const topSummary=component.indexOf("<summary ",render);
  const expanded=component.indexOf("<ShadowNineOverview",render);
  const quick=component.indexOf("quick.icon",topSummary);
  assert.ok(render>0 && topSummary>render && quick>topSummary && expanded>quick);
  assert.match(component,/useEffect\(\(\) => \{\s*void load\(\);/);
  assert.match(component,/inFlight\.current \|\| report/);
  assert.match(component,/role="status" aria-live="polite"/);
  assert.doesNotMatch(component,/onToggle=\{event =>/);
  const api=read("app/api/admin/shadow-candle-nine-overview/route.ts");
  assert.ok(api.indexOf("if (!isOwner)") < api.indexOf("await fetchCohort([code])"));
  assert.match(api,/fetchCohort\(\[code\]\)/);
  const layout=read("app/analysis/[code]/layout.tsx");
  assert.ok(layout.indexOf("if(!isOwner)return <>{children}</>") < layout.indexOf("<OwnerCandleNineSummary"));
});
