import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {evaluateMorningProbe} from "../app/lib/research/morningProbeShadow.mjs";
import {
  inspectPreopenNasdaq,inspect0915CompletedBars,
  assess0915ShadowReview,summarize0915ShadowReviews,MORNING_0915_REVIEW_VERSION,
} from "../app/lib/research/morning0915Review.mjs";
const day="2026-11-06";
const at=(time)=>day+"T"+time+"+09:00";
const candle=(slot,open,close,vol=1000)=>({
  time:Date.parse(at(slot+":00"))/1000,open,
  high:Math.max(open,close)+0.1,low:Math.min(open,close)-0.1,
  close,volume:vol,
});
const candles=[
  candle("09:00",100,100.2,1000),
  candle("09:05",100.2,100.6,2000),
  candle("09:10",100.6,101.2,3000),
];
const goodProbe=(overrides={})=>evaluateMorningProbe({
  tradeDate:day,code:"3762",bars:candles,
  requestedAt:at("09:15:25"),receivedAt:at("09:15:32"),...overrides,
});
const market=(pct=-1,overrides={})=>({
  trade_date:day,policy_version:"PREOPEN_US_FX_GAP_V1",
  state:"COMPLETE",captured_at:at("08:45:10"),
  source:"Yahoo Finance daily chart",
  quotes:{nasdaq:{price:24314.998,state:"REFERENCE",changePct:pct,
    quoteDate:"2026-11-05",sourceTimestamp:"2026-11-05T14:30:00.000Z"}},
  ...overrides,
});
const candidate={code:"3762",rank:1,score:95,referencePrice:100};
const review=(options={})=>assess0915ShadowReview({
  tradeDate:day,candidate,probe:goodProbe(),marketRow:market(),...options,
});

test("09:15 completed bars are read only after receiving them",()=>{
  const p=goodProbe(),o=inspect0915CompletedBars(p,day,candidate.code);
  assert.equal(o.state,"OBSERVED");
  assert.equal(o.sourceSlot,"09:15");
  assert.equal(o.proxyPrice,101.2);
  assert.equal(o.changeFromFirstOpenPct,1.2);
  assert.equal(o.threeBarVolume,6000);
  assert.equal(o.trendUp,true);
  assert.equal(o.volumeConfirmed,true);
  assert.equal(o.eligibleForRealOrders,false);
});
test("unshocked US reference and rising 3-bars is watch-only, never BUY",()=>{
  const r=review();
  assert.equal(r.status,"TREND_WATCH_ONLY");
  assert.equal(r.eligibleForTrading,false);
  assert.equal(r.eligibleForAiPower,false);
  assert.equal(r.eligibleForNotifications,false);
  assert.equal(r.market.verifiedJapanMarket,false);
  assert.equal(r.referenceCost100Yen,10120);
  assert.equal(r.policy,MORNING_0915_REVIEW_VERSION);
});
test("US Nasdaq drop pre-saved before market open overrides bullish bars",()=>{
  const r=review({marketRow:market(-5.523)});
  assert.equal(r.status,"PAUSE_MARKET_RISK");
  assert.equal(r.market.state,"PAUSE_US_SHOCK");
  assert.equal(r.market.changePct,-5.523);
});
test("shock still pauses when 09:15 provider bars are unavailable",()=>{
  const r=review({probe:goodProbe({bars:[candles[0]]}),marketRow:market(-3.5)});
  assert.equal(r.status,"PAUSE_MARKET_RISK");
  assert.equal(r.opening.state,"UNAVAILABLE");
});
test("missing snapshot is WAIT, not a safe buy",()=>{
  const r=review({marketRow:null});
  assert.equal(r.status,"WAIT_FOR_MARKET_DATA");
  assert.equal(r.market.state,"UNKNOWN");
  assert.equal(r.eligibleForTrading,false);
});
test("future or stale or invalid preopen observation never unlocks research",()=>{
  assert.equal(review({marketRow:market(-0.1,{captured_at:at("09:20:00")})}).status,"WAIT_FOR_MARKET_DATA");
  assert.equal(review({marketRow:market(-0.1,{captured_at:at("08:10:00")})}).status,"WAIT_FOR_MARKET_DATA");
  const invalid=market(0.1);
  invalid.quotes.nasdaq.sourceTimestamp=at("09:40:00");
  assert.equal(review({marketRow:invalid}).market.state,"UNKNOWN");
  const stale=market(0.1);
  stale.quotes.nasdaq.quoteDate="2026-10-20";
  assert.equal(review({marketRow:stale}).market.state,"UNKNOWN");
});
test("macro observation must be exactly saved prior-session Yahoo reference",()=>{
  const unknown=inspectPreopenNasdaq(market(-5.523,{source:"not verified"}),day,at("09:15:32"));
  assert.equal(unknown.state,"UNKNOWN");
  const unknown2=inspectPreopenNasdaq({...market(-5.523),trade_date:"2026-11-05"},day,at("09:15:32"));
  assert.equal(unknown2.state,"UNKNOWN");
  const unknown3=inspectPreopenNasdaq({...market(-5.523),policy_version:"UNKNOWN"},day,at("09:15:32"));
  assert.equal(unknown3.state,"UNKNOWN");
});
test("one missing 09:05 bar never turns into a BUY_CANDIDATE",()=>{
  const p=goodProbe({bars:[candles[0],candles[2]]});
  assert.equal(review({probe:p}).status,"WAIT_FOR_BAR_DATA");
  assert.equal(inspect0915CompletedBars(p,day,"3762").state,"UNAVAILABLE");
});
test("incoming 09:15 unfinished/future bars cannot affect completed-bucket decision",()=>{
  const p=goodProbe({bars:[...candles,candle("09:15",100,9000,999999)]});
  const o=inspect0915CompletedBars(p,day,"3762");
  assert.equal(o.state,"OBSERVED");
  assert.equal(o.proxyPrice,101.2);
  assert.equal(o.threeBarVolume,6000);
  const tampered=JSON.parse(JSON.stringify(goodProbe()));
  tampered.observedBars.push({slot:"09:15",barStartAt:at("09:15:00"),
    barClosedByReceipt:true,open:100,close:99999,volume:900000});
  assert.equal(inspect0915CompletedBars(tampered,day,"3762").state,"UNAVAILABLE");
});
test("the 09:20 observation cannot be relabeled as available at 09:15",()=>{
  const p=goodProbe({requestedAt:at("09:20:10"),receivedAt:at("09:20:20")});
  assert.equal(p.status,"AVAILABLE_AS_OF_RECEIPT");
  const r=review({probe:p});
  assert.equal(r.sourceSlot,"09:20");
  assert.equal(r.opening.observedAt,new Date(at("09:20:20")).toISOString());
  assert.notEqual(r.sourceSlot,"09:15");
});
test("cross-slot, duplicate, bad timestamps or swapped stock code are rejected",()=>{
  const p=goodProbe();
  const rolled=JSON.parse(JSON.stringify(p));
  rolled.receivedAt=at("09:20:00");
  assert.equal(inspect0915CompletedBars(rolled,day,"3762").state,"UNAVAILABLE");
  const dup=JSON.parse(JSON.stringify(p));
  dup.observedBars.push({...dup.observedBars[0]});
  assert.equal(inspect0915CompletedBars(dup,day,"3762").state,"UNAVAILABLE");
  assert.equal(inspect0915CompletedBars(p,day,"9468").state,"UNAVAILABLE");
  const reversed=JSON.parse(JSON.stringify(p));
  reversed.requestedAt=at("09:16:00");
  assert.equal(inspect0915CompletedBars(reversed,day,"3762").state,"UNAVAILABLE");
});
test("reference budget filter is not mistaken for an executable order",()=>{
  const small=review({budgetYen:10000});
  assert.equal(small.status,"OVER_BUDGET_REFERENCE");
  assert.equal(small.referenceCost100Yen,10120);
  assert.equal(small.eligibleForTrading,false);
});
test("unstable gap and weak close-to-close progress are rejected",()=>{
  assert.equal(review({candidate:{...candidate,referencePrice:110}}).status,"CAUTION_REFERENCE_GAP");
  const weak=goodProbe({bars:[candle("09:00",100,99.8),candle("09:05",99.8,99.5),candle("09:10",99.5,99.2)]});
  assert.equal(review({probe:weak}).status,"CAUTION_WEAK_MOMENTUM");
});
test("zero-volume pseudo-rise cannot count as volume confirmed",()=>{
  const p=goodProbe({bars:[
    candle("09:00",100,100.2,0),
    candle("09:05",100.2,100.6,0),
    candle("09:10",100.6,101.2,0),
  ]});
  assert.equal(review({probe:p}).status,"CAUTION_WEAK_MOMENTUM");
  assert.equal(review({probe:p}).opening.volumeConfirmed,false);
});
test("summary never claims real trade signals, accuracy or fills",()=>{
  const arr=[review(),review({marketRow:market(-5.1)}),review({marketRow:null})];
  const s=summarize0915ShadowReviews(arr);
  assert.equal(s.total,3);
  assert.equal(s.watchOnly,1);
  assert.equal(s.paused,1);
  assert.equal(s.actualBuySignals,0);
  assert.equal(s.forwardAccuracy,null);
  assert.equal(s.tradingEnabled,false);
});
test("manual route remains owner-authorized, explicit POST, no DB mutation",()=>{
  const route=readFileSync("app/api/admin/morning-probe-shadow/route.ts","utf8");
  const ui=readFileSync("app/admin/night-morning-watch/MorningProbeDownload.tsx","utf8");
  assert.match(route,/getLearningOwnerSession/);
  assert.match(route,/origin!==new URL\(request.url\)\.origin/);
  assert.match(route,/export async function POST\(request:Request\)/);
  assert.doesNotMatch(route,/export async function GET\(/);
  assert.match(route,/market\.rows\.length===1\?market\.rows\[0\]:null/);
  assert.match(route,/assess0915ShadowReview/);
  assert.match(route,/sealMorningProbeArchive\(batch\)/);
  assert.match(route,/WHERE trade_date=\$1::date AND policy_version=\$2 LIMIT 2/);
  assert.doesNotMatch(route,/INSERT INTO|UPDATE public|DELETE FROM|brokerOrder|sendLine/);
  assert.match(ui,/onClick=\{download\}/);
  assert.match(ui,/TREND_WATCH_ONLY/);
});
