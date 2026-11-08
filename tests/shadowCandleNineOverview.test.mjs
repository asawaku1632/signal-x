import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { summarizeShadowNine } from "../app/lib/research/shadowCandleNineOverview.ts";

const read = p=>readFileSync(new URL(`../${p}`,import.meta.url),"utf8");
const start = Date.parse("2026-10-19T06:00:00Z") / 1000;
const candles=Array.from({length:15},(_,index)=>({time:start+index*86400,open:100,high:102,low:98,close:100}));
const bullish={id:"SH_CDL_BULL_HARAMI",name:"強気のはらみ線",direction:"BUY",
  index:13,time:candles[13].time,entryClose:100,location:"安値圏",reasons:["大陰線→小陽線"]};
const bearish={id:"SH_CDL_BEAR_HARAMI",name:"弱気のはらみ線",direction:"SELL",
  index:4,time:candles[4].time,entryClose:100,location:"高値圏",reasons:["大陽線→小陰線"]};
const types=[
  {definition:{id:"SH_CDL_BULL_HARAMI",name:"強気のはらみ線",direction:"BUY"},hits:[bullish]},
  {definition:{id:"SH_CDL_BEAR_HARAMI",name:"弱気のはらみ線",direction:"SELL"},hits:[bearish]},
  {definition:{id:"SH_CDL_BULL_MEETING",name:"強気の出会い線",direction:"BUY"},hits:[]},
];
function result(level="NONE"){return {level,ruleVersion:"BUY_CAUTION_SHADOW_V1",signals:[]};}

test("overview: clear HOLD/no current bearish and recent historic bullish signal, no misleading total rate",()=>{
  const answer=summarizeShadowNine(types,candles,result());
  assert.equal(answer.status,"NO_BEARISH");
  assert.equal(answer.heading,"買い判断は保留");
  assert.equal(answer.hitCount,2);
  assert.equal(answer.detectedTypes,2);
  assert.equal(answer.recentBarSignals,0);
  assert.equal(answer.completedFiveDay,1);
  assert.equal(answer.totalFiveDay,2);
  assert.equal(answer.sessionsSinceLastHit,1);
  assert.equal(answer.mostRecentHits[0].name,"強気のはらみ線");
  assert.equal(answer.fiveDayPendingForMostRecent,true);
  assert.doesNotMatch(answer.explanation,/買い推奨|購入すべき|上がる確率/);
});

test("caution priority wins, but no automatic trading recommendation",()=>{
  const answer=summarizeShadowNine(types,candles,result("CAUTION"));
  assert.equal(answer.status,"CAUTION");
  assert.match(answer.explanation,/追加|下落/);
});

test("same-day two patterns remain visible; no hits and stale input are safe",()=>{
  const same={...bearish,index:13,time:candles[13].time};
  const studies=[types[0],{...types[1],hits:[same]}];
  const answer=summarizeShadowNine(studies,candles,result("OBSERVE"));
  assert.equal(answer.recentBarSignals,0); // latest bar = index14, not 13
  assert.equal(answer.mostRecentHits.length,2);
  assert.equal(answer.status,"WATCH");
  const empty=summarizeShadowNine(types.map(x=>({...x,hits:[]})),candles,result("STALE"));
  assert.equal(empty.status,"STALE");
  assert.equal(empty.hitCount,0);
  assert.equal(empty.mostRecentDate,null);
  assert.equal(empty.sessionsSinceLastHit,null);
});

test("owner-only page shows overview before verbose study, omits 100% for single hit",()=>{
  const page=read("app/admin/shadow-candlestick-nine/page.tsx");
  assert.ok(page.indexOf("if (!isOwner) notFound()") < page.indexOf("await fetchOneDailyHistory(requested)"));
  assert.ok(page.indexOf("<ShadowNineOverview") < page.indexOf("<ShadowBuyCautionPanel"));
  assert.ok(page.indexOf("<ShadowNineOverview") < page.indexOf("1・3・5営業日後の研究成績"));
  assert.match(page,/h.completed < 5/);
  assert.match(page,/参考・件数不足/);
  assert.match(page,/detectedStudies.map/);
  assert.match(page,/undetectedStudies.map/);
  assert.match(page,/銘柄コードは英数字4〜5文字/);
  assert.doesNotMatch(page,/\b(?:INSERT|UPDATE|DELETE|sendLine|runScan|placeOrder)\s*\(/);
  const overview=read("app/admin/shadow-candlestick-nine/ShadowNineOverview.tsx");
  assert.match(overview,/総合結果/);
  assert.match(overview,/買い推奨・購入禁止の判定ではありません/);
  assert.match(overview,/5日後の結果はまだ未確定/);
});
