import assert from "node:assert/strict";
import test from "node:test";
import {readFileSync} from "node:fs";
import {fileURLToPath} from "node:url";
import {
 NIGHT_HOLDING_POLICY, NIGHT_HOLDING_SLOTS,
 holdingTradingDates,captureHoldingEntryAnchors,
 buildNightHoldingStudy,summarizeNightHolding,summarizeMorningGateHolding,holdingPnl100,
} from "../app/lib/research/nightTimingHolding.mjs";

const date="2026-10-21";
const weekday=d=>![0,6].includes(new Date(d+"T00:00:00Z").getUTCDay());
const time=(d,t)=>new Date(d+"T"+t+":00+09:00");
const bar=(d,t,price)=>({time:time(d,t).getTime()/1000,open:price});
const candidate={code:"2503",name:"キリンHD",score:91,referencePrice:2937.5,rank:1};
const frozen=()=>({trade_date:date,prior_date:"2026-10-20",frozen_at:time("2026-10-20","18:12").toISOString(),
  cohort:[{...candidate}],morning_state:"COMPLETE",
  morning_saved_at:time(date,"09:12").toISOString(),
  morning_observations:[{code:"2503",priorScore:91,priorReferencePrice:2937.5,
    price0905:2940,label:"SKIP"}]});
const anchors=()=>captureHoldingEntryAnchors(date,"2503",[
  bar(date,"09:00",2935),bar(date,"09:05",2940),
  bar(date,"09:15",2929),bar(date,"09:30",2926),
]);
const result=()=>({date,code:"2503",name:"キリンHD",complete:true,priorScore:91,
  priorReferencePrice:2937.5,closePrice:2950,
  entries:[{time:"09:05",entryPrice:2940},{time:"09:30",entryPrice:2926}],
  holdingAnchors:anchors()});
const archive=()=>({trade_date:date,prior_date:"2026-10-20",status:"COMPLETE",
  finished_at:time(date,"16:45").toISOString(),results:[result()]});
const future=(d,p,saved="15:41")=>({date:d,code:"2503",price:p,created_at:time(d,saved).toISOString()});
const fixture=(overrides={})=>({
  frozenRuns:[frozen()],archiveRuns:[archive()],
  priceRows:[future("2026-10-22",2970),future("2026-10-26",2990),future("2026-10-28",3020)],
  isTradingDate:weekday,now:time("2026-10-29","19:00"),
  ...overrides,
});

test("exact same-day Yahoo bar START timestamps produce four indicative OPEN prices",()=>{
  const a=anchors();
  assert.equal(a.version,NIGHT_HOLDING_POLICY);
  assert.deepEqual(a.entries.map(e=>[e.time,e.price]),[
    ["09:00",2935],["09:05",2940],["09:15",2929],["09:30",2926]]);
  assert.equal(captureHoldingEntryAnchors(date,"2503",[bar("2026-10-20","09:15",1)])
    .entries.find(e=>e.time==="09:15").price,null);
});

test("trading horizons skip Saturday and Sunday (and explicit holidays)",()=>{
  const d=holdingTradingDates(date,weekday);
  assert.deepEqual(d,{0:"2026-10-21",1:"2026-10-22",3:"2026-10-26",5:"2026-10-28"});
  const withHoliday=holdingTradingDates(date,x=>weekday(x)&&x!=="2026-10-22");
  assert.equal(withHoliday[1],"2026-10-23");
  assert.equal(withHoliday[3],"2026-10-27");
});

test("exact frozen cohort matches independent after-close archive and later saved references",()=>{
  const rows=buildNightHoldingStudy(fixture());
  assert.equal(rows.length,1);
  assert.deepEqual(Object.values(rows[0].exits),[2950,2970,2990,3020]);
  assert.equal(rows[0].entries["09:15"],2929);
  assert.equal(holdingPnl100(rows[0],"PREVIOUS_REFERENCE",0),1250);
  assert.equal(holdingPnl100(rows[0],"09:05",0),1000);
  assert.equal(holdingPnl100(rows[0],"09:30",3),6400);
  assert.equal(NIGHT_HOLDING_SLOTS.length,5);
});

test("saved same-morning skip is matched, not guessed retrospectively",()=>{
  const rows=buildNightHoldingStudy(fixture());
  assert.equal(rows[0].morningGate,"SKIP");
  assert.equal(summarizeMorningGateHolding(rows)[0].count,1);
  assert.equal(summarizeMorningGateHolding(rows)[0].skipCount,1);
  assert.equal(summarizeMorningGateHolding(rows)[0].avoidedLoss100,null); // insufficient sample

  const absent=frozen();absent.morning_saved_at=null;
  assert.equal(buildNightHoldingStudy(fixture({frozenRuns:[absent]}))[0].morningGate,null);
  const tooLate=frozen();tooLate.morning_saved_at=time(date,"09:20").toISOString();
  assert.equal(buildNightHoldingStudy(fixture({frozenRuns:[tooLate]}))[0].morningGate,null);
  const mismatch=frozen();mismatch.morning_observations[0].price0905=2970;
  assert.equal(buildNightHoldingStudy(fixture({frozenRuns:[mismatch]}))[0].morningGate,null);
});

test("unfrozen next morning or mutated historical candidate cannot be reclassified",()=>{
  const modified=frozen();modified.frozen_at=time(date,"09:10").toISOString();
  assert.equal(buildNightHoldingStudy(fixture({frozenRuns:[modified]})).length,0);
  const mismatched=archive();mismatched.results[0].priorScore=95;
  assert.equal(buildNightHoldingStudy(fixture({archiveRuns:[mismatched]})).length,0);
  const changed=frozen();changed.cohort[0].referencePrice=3000;
  assert.equal(buildNightHoldingStudy(fixture({frozenRuns:[changed]})).length,0);
});

test("missing 09:15 archive is UNKNOWN, never fabricated from 09:05/09:30",()=>{
  const old=archive();
  delete old.results[0].holdingAnchors;
  const rows=buildNightHoldingStudy(fixture({archiveRuns:[old]}));
  assert.equal(rows.length,1);
  assert.equal(rows[0].entries["09:15"],null);
  assert.equal(rows[0].entries["09:00"],null);
  assert.equal(rows[0].entries["09:05"],2940);
  assert.equal(summarizeNightHolding(rows)[0].paired,0);
  assert.equal(holdingPnl100(rows[0],"09:15",0),null);
});

test("future-day incomplete, too-early or wrong-date saved prices are missing, not zero",()=>{
  const priceRows=[future("2026-10-22",2970,"14:00"),future("2026-10-26",2990)];
  const rows=buildNightHoldingStudy(fixture({priceRows}));
  assert.equal(rows[0].exits[1],null);
  assert.equal(rows[0].exits[3],2990);
  assert.equal(rows[0].exits[5],null);
  assert.equal(holdingPnl100(rows[0],"09:05",5),null);
  assert.equal(summarizeNightHolding(rows)[1].paired,0);
});

test("all 5 entry strategies use exact same matched stock-days per horizon",()=>{
  const copies=[];
  for(let i=0;i<30;i++){
    const source=buildNightHoldingStudy(fixture())[0];
    copies.push({...source,date:"2026-10-"+String(i%10+1).padStart(2,"0"),
      code:String(3000+i)});
  }
  const s=summarizeNightHolding(copies);
  assert.equal(s[0].sufficient,true);
  assert.equal(s[0].paired,30);
  assert.equal(s[0].comparison[0].count,s[0].comparison[4].count);
  assert.equal(s[3].comparison[0].wins,30);
  assert.equal(s[1].comparison[0].winRate,100);
  const gates=summarizeMorningGateHolding(copies);
  assert.equal(gates[0].sufficient,true);
  assert.equal(gates[0].skipCount,30);
  assert.equal(gates[0].missedProfit100,30000); // 09:05 reference 2940 -> 2950 for 30 cases
  assert.equal(gates[0].avoidedLoss100,0);
});

test("no new scan, market requests, cron, alerts or trade paths added",()=>{
  const get=p=>readFileSync(fileURLToPath(new URL("../"+p,import.meta.url)),"utf8");
  const runner=get("app/lib/research/entryTimeShadowRunner.ts");
  const page=get("app/admin/night-entry-holding/page.tsx");
  const lib=get("app/lib/research/nightTimingHolding.mjs");
  assert.match(runner,/const extended=holdingAnchors\?\{\.\.\.original,holdingAnchors\}:original/);
  assert.match(page,/getLearningOwnerSession\(\)/);
  assert.match(page,/if\(!isOwner\)notFound\(\)/);
  assert.doesNotMatch(page,/fetch\(|INSERT INTO|UPDATE public|DELETE FROM/);
  assert.doesNotMatch(lib,/fetch\(|INSERT INTO|UPDATE public|DELETE FROM/);
});
