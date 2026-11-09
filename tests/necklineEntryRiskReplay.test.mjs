import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  replayNecklineEntryRisk,
  NECKLINE_CHRONOLOGICAL_SPLIT,
  NECKLINE_ENTRY_SCENARIOS,
  NECKLINE_EXTENDED_MAX_SYMBOLS,
} from "../app/lib/research/necklineEntryRiskReplay.mjs";

const root=join(dirname(fileURLToPath(import.meta.url)),"..");
const read=path=>readFileSync(join(root,path),"utf8");
const now=new Date("2026-11-09T17:00:00+09:00");
function fixture(count=44,start=1700000000) {
  const bars=Array.from({length:count},(_,i)=>({
    time:start+i*86400,open:98,high:100,low:97,close:98,volume:1000,
  }));
  bars[10]={...bars[10],low:90,close:95};
  bars[17]={...bars[17],high:105,close:102};
  bars[24]={...bars[24],low:91,close:92};
  bars[25]={...bars[25],low:92,close:94};
  bars[26]={...bars[26],low:93,close:98};
  if(count>33)bars[33]={...bars[33],high:109,close:108,volume:2500};
  return bars;
}
const asStock=(code,candles,error=null)=>({code,candles,error});

test("three causal entry rules preserve failures, non-entries and mature denominators",()=>{
  const success=fixture();
  const failure=fixture();
  failure[26]={...failure[26],high:102,close:101}; // near threshold known on detection day
  failure[33]={...failure[33],open:95,high:99,low:80,close:85};
  const out=replayNecklineEntryRisk([asStock("7164",success),asStock("3774",failure)],now);
  assert.equal(out.sample.candidates,2);
  assert.equal(out.status.breakout,1);
  assert.equal(out.status.invalidated,1);
  assert.equal(out.scenarios.length,3);
  const [initial,near,breakout]=out.scenarios;
  assert.equal(initial.qualified,2);
  assert.equal(initial.noEntry,0);
  assert.equal(initial.day3.completed,2);
  assert.equal(initial.day5.completed,2);
  assert.equal(near.qualified,1);
  assert.equal(near.noEntry,1);
  assert.equal(near.day5.completed,1);
  assert.equal(breakout.qualified,1);
  assert.equal(breakout.noEntry,1);
  assert.equal(breakout.day5.completed,1);
  assert.equal(breakout.pending5,0);
  assert.equal(initial.worstCases,undefined);
  assert.equal(out.worstCases.length,2);
  assert.equal(out.records.find(x=>x.code==="3774").scenarios.BREAKOUT.qualified,false);
  assert.equal(out.records.find(x=>x.code==="3774").scenarios.NEAR.qualified,true);
});

test("unmatured candidates and confirmed-breakout entries remain pending, never fictional wins",()=>{
  const latest=fixture(27);
  const out=replayNecklineEntryRisk([asStock("7164",latest)],now);
  assert.equal(out.sample.candidates,1);
  assert.equal(out.status.watch,1);
  assert.equal(out.scenarios[0].qualified,1);
  assert.equal(out.scenarios[0].day3.completed,0);
  assert.equal(out.scenarios[0].day5.completed,0);
  assert.equal(out.scenarios[0].pending5,1);
  assert.equal(out.scenarios[2].qualified,0);
  assert.equal(out.scenarios[2].noEntry,1);
  assert.equal(out.scenarios[2].day5.meanPercent,null);
  assert.equal(out.scenarios[0].loss3Percent,null);
  assert.equal(out.worstCases.length,0);
});

test("future prices do not change earlier eligibility or the detection-day features",()=>{
  const baseline=fixture(),modified=fixture();
  modified[34]={...modified[34],open:50,high:500,low:10,close:499,volume:200000};
  const first=replayNecklineEntryRisk([asStock("7164",baseline)],now);
  const second=replayNecklineEntryRisk([asStock("7164",modified)],now);
  assert.deepEqual(first.records[0].frozenFeatures,second.records[0].frozenFeatures);
  assert.equal(first.records[0].scenarios.NEAR.qualified,second.records[0].scenarios.NEAR.qualified);
  assert.equal(first.records[0].scenarios.DETECTION.hold5.returnPercent,
    second.records[0].scenarios.DETECTION.hold5.returnPercent);
  assert.equal(first.records[0].scenarios.DETECTION.hold5.maxAdversePercent,
    second.records[0].scenarios.DETECTION.hold5.maxAdversePercent);
  // After a breakout, future changes can change its realized 5-day *outcome*,
  // but NEVER the prior decision or the original candidate classification.
  assert.equal(first.records[0].scenarios.BREAKOUT.qualified,second.records[0].scenarios.BREAKOUT.qualified);
});

test("calendar split is disjoint by firstSeenDate, never incorrectly called independent validation",()=>{
  const recentStart=Date.parse("2026-08-03T00:00:00+09:00")/1000;
  const out=replayNecklineEntryRisk([
    asStock("7164",fixture()),
    asStock("3774",fixture(44,recentStart)),
  ],now);
  assert.equal(out.chronologicalSplit,NECKLINE_CHRONOLOGICAL_SPLIT);
  assert.equal(out.periods.reduce((n,x)=>n+x.candidates,0),out.sample.candidates);
  assert.equal(out.periods[0].candidates,1);
  assert.equal(out.periods[1].candidates,1);
  assert.equal(out.independentOutOfSample,false);
  assert.equal(out.prospective,false);
  assert.equal(out.replayOnly,true);
  assert.ok(out.periods.every(p=>p.scenarios.every(s=>s.candidates===p.candidates)));
});

test("15-code hard cap, duplicate and invalid stocks fail closed, missing stock is listed",()=>{
  assert.equal(NECKLINE_EXTENDED_MAX_SYMBOLS,15);
  assert.equal(NECKLINE_ENTRY_SCENARIOS.length,3);
  const all=Array.from({length:15},(_,i)=>asStock(String(1000+i),fixture()));
  const result=replayNecklineEntryRisk(all,now);
  assert.equal(result.sample.requestedSymbols,15);
  assert.equal(result.sample.usableSymbols,15);
  assert.equal(result.sample.candidates,15);
  assert.throws(()=>replayNecklineEntryRisk([...all,asStock("9999",fixture())],now));
  assert.throws(()=>replayNecklineEntryRisk([all[0],all[0]],now));
  const missing=replayNecklineEntryRisk([asStock("7164",fixture()),asStock("3774",[], "通信失敗")],now);
  assert.equal(missing.sample.usableSymbols,1);
  assert.equal(missing.sample.excludedSymbols,1);
  assert.equal(missing.sample.details[1].status,"EXCLUDED");
});

test("owner checks are before bounded calls, and UI does not enable trading or notifications",()=>{
  const page=read("app/admin/neckline-entry-risk/page.tsx");
  const loader=read("app/lib/research/shadowCandleYahoo.ts");
  const old=read("app/admin/neckline-quality/page.tsx");
  const hub=read("app/admin/learning-hub/page.tsx");
  assert.ok(page.indexOf("if(!isOwner)notFound()")<page.indexOf("fetchNecklineExtendedCohort(codes)"));
  assert.match(page,/const run=params\.run==="1"/);
  assert.match(page,/codes\.length>15/);
  assert.match(page,/export const maxDuration = 60/);
  assert.match(page,/前半と後半で再現する/);
  assert.match(page,/将来の成績を見ずに条件を決めて別期間で試した「独立検証」ではありません/);
  assert.match(page,/5営業日中の最大下落幅/);
  assert.match(loader,/fetchBoundedCohort\(codes, 5\)/);
  assert.match(loader,/fetchBoundedCohort\(codes, 15\)/);
  assert.match(loader,/Math\.min\(3, codes\.length\)/);
  assert.match(old,/href="\/admin\/neckline-entry-risk"/);
  assert.match(hub,/href: "\/admin\/neckline-entry-risk"/);
  assert.doesNotMatch(page,/UPDATE public\.|INSERT INTO|pushNotification|sendNotification|tradingOrder/);
});
