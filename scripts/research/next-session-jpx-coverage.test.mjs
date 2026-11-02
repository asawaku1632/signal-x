import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {isJpxStockCode,fromJquantsFiveCharacterCode} from
  "../../app/lib/research/jpxStockCode.mjs";
import {freezeBudgetUniverse} from "../../app/lib/research/budgetUniverseFreeze.mjs";
import {buildNextSessionBudgetWatch} from "../../app/lib/research/nextSessionBudgetWatch.mjs";
import {assessAsOfCatalysts} from "../../app/lib/research/nextSessionCatalystAudit.mjs";
import {normalizeTdnetIndex} from "../../app/lib/research/authorizedTdnetIndex.mjs";
import {summarizeMorningCaptureHealth} from "../../app/lib/research/morningCaptureHealth.mjs";

test("JPX 2024+ alphabetic code formats including 590A/641A/642A",()=>{
  for(const code of ["5333","590A","641A","642A","9A7A","1A00"])assert.equal(isJpxStockCode(code),true,code);
  for(const code of ["0000","590B","59EA","abcd","590a","590AA","533"])assert.equal(isJpxStockCode(code),false,code);
});
test("five-character J-Quants code safely decodes only true JPX code + terminal zero",()=>{
  assert.equal(fromJquantsFiveCharacterCode("590A0"),"590A");
  assert.equal(fromJquantsFiveCharacterCode("53330"),"5333");
  assert.equal(fromJquantsFiveCharacterCode("590A1"),null);
  assert.equal(fromJquantsFiveCharacterCode("00000"),null);
});
const start="2026-11-02T17:05:00+09:00";
const rows=Array.from({length:100},(_,i)=>({
  code:String(1000+i),name:"fixture-"+i,price:1000,score:90,
  snapshotDate:"2026-11-02",savedAt:start
}));
rows[0]={...rows[0],code:"590A"};
rows[1]={...rows[1],code:"641A"};
rows[2]={...rows[2],code:"642A"};
test("full previous-night frozen universe includes three legitimate letter codes",()=>{
  const r=freezeBudgetUniverse({
    sourceDate:"2026-11-02",tradeDate:"2026-11-04",
    frozenAt:"2026-11-02T18:10:00+09:00",
    expectedUniverseCount:100,rows,
  });
  assert.equal(r.observedUniverseCount,100);
  assert.ok(["590A","641A","642A"].every(code=>r.cohort.some(x=>x.code===code)));
  assert.ok(r.budgets.find(x=>x.budgetYen===100000).codes.includes("590A"));
});
test("shortlist and IR timestamps can carry an alphanumeric symbol",()=>{
  const watch=buildNextSessionBudgetWatch({
    rows:[{code:"590A",name:"fixture",score:95,price:1100,snapshotDate:"2026-11-02"}],
    sourceDate:"2026-11-02",tradeDate:"2026-11-04",budgetYen:300000,
  });
  assert.equal(watch.candidates[0].code,"590A");
  const catalysts=assessAsOfCatalysts({code:"590A",freezeAt:"2026-11-02T18:10:00+09:00",records:[]});
  assert.equal(catalysts.status,"NOT_VERIFIED");
});
test("TDnet Code 590A0 is correctly normalized but never promoted by title alone",()=>{
  const data={data:[{
    DiscNo:"20261102590000",Code:"590A0",DiscDate:"2026-11-02",
    DiscTime:"15:40",Title:"業績予想の上方修正に関するお知らせ",Name:"fixture"
  }]};
  const out=normalizeTdnetIndex(data,{
    observedAt:"2026-11-02T16:30:00+09:00",date:"2026-11-02"
  });
  assert.equal(out.items.length,1);
  assert.equal(out.items[0].code,"590A");
  assert.equal(out.items[0].status,"INDEX_HINT_ONLY");
});
test("all 45 morning records unavailable => no backtest signal",()=>{
  const records=Array.from({length:9},(_,i)=>({
    trade_date:"2026-10-"+String(21+i).padStart(2,"0"),
    morning_observations:Array.from({length:5},(_,j)=>({
      code:String(1000+j),label:"UNAVAILABLE",
      quoteReason:j<4?"MISSING_CANDLES":null
    }))
  }));
  const q=summarizeMorningCaptureHealth(records);
  assert.equal(q.days,9);assert.equal(q.slots,45);
  assert.equal(q.available,0);assert.equal(q.unavailable,45);
  assert.equal(q.status,"NO_USABLE_MORNING_DECISIONS");
});
test("actual valid saved BUY_CANDIDATE counts, unavailable remains missing",()=>{
  const out=summarizeMorningCaptureHealth([{trade_date:"2026-11-02",
    morning_observations:[{code:"590A",label:"BUY_CANDIDATE"},
      {code:"641A",label:"UNAVAILABLE",quoteReason:"MISSING_CANDLES"}]}]);
  assert.equal(out.availablePct,50);
  assert.equal(out.missing,1);
  assert.equal(out.status,"PARTIAL_MORNING_COVERAGE");
});
test("invalid or duplicated trade days do not inflate capture coverage",()=>{
  const a={trade_date:"2026-10-30",morning_observations:[{code:"5333",label:"SKIP"}]};
  const x=summarizeMorningCaptureHealth([a,a,{trade_date:"n/a"}]);
  assert.equal(x.days,1);assert.equal(x.slots,1);
});
test("SQL explicitly converts naive UTC created_at before freezing",()=>{
  const runner=readFileSync("app/lib/research/budgetUniverseFreezeRunner.ts","utf8");
  assert.match(runner,/created_at AT TIME ZONE 'UTC'/);
  assert.match(runner,/ON CONFLICT \(trade_date\) DO NOTHING/);
});
test("owner page is not duplicated and has an explicit missing-candle alert",()=>{
  const ui=readFileSync("app/admin/night-morning-watch/page.tsx","utf8");
  assert.equal(ui.split("return <main").length-1,1);
  assert.equal(ui.split("</main>;").length-1,1);
  assert.match(ui,/summarizeMorningCaptureHealth/);
  assert.match(ui,/5分足不足/);
});

test("read-only candidate SQL has a complete quoted JPX regex and price cap",()=>{
  const page=readFileSync("app/admin/night-morning-watch/page.tsx","utf8");
  assert.match(page,/AND code ~ '\^\[1-9\]/);
  assert.match(page,/AND score<=100 AND price>0/);
  assert.doesNotMatch(page,/code ~ '\^\[0-9A-Z\]\{4\} /);
});
test("server freeze compares UTC-naive stored times explicitly against UTC cutoff",()=>{
  const runner=readFileSync("app/lib/research/budgetUniverseFreezeRunner.ts","utf8");
  assert.match(runner,/\(created_at AT TIME ZONE 'UTC'\)<\=\$2::timestamptz/);
});
test("no morning archive must remain NO_CAPTURE_DATA rather than inventing zero losses",()=>{
  const health=summarizeMorningCaptureHealth([]);
  assert.equal(health.status,"NO_CAPTURE_DATA");
  assert.equal(health.availablePct,null);
  assert.equal(health.slots,0);
});
