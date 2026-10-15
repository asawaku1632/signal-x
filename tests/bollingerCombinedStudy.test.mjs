import assert from "node:assert/strict";
import test from "node:test";
import {readFileSync} from "node:fs";
import {
 evaluateCombinedResearch,signalLocalDate,researchPeriod,matchesResearchRule,MIN_SAMPLE,RULES
} from "../app/lib/research/bollingerCombinedStudy.mjs";

const ts=date=>Math.round(Date.parse(date+"T06:00:00.000Z")/1000);
const row=(code,date,h,ret=1,options={})=>({
 code,signal_time:String(ts(date)),group_key:"SQUEEZE_UP_BREAKOUT",
 horizon:h,return_percent:ret,max_adverse_percent:-3,
 rsi_group:"RSI_50_TO_70",trend_group:"TREND_UP_5_PLUS",
 breakout_group:"BREAKOUT_2_PLUS",volume_bucket:"HIGH_1_3X",...options
});
const set=()=>{
 const data=[];
 for(let i=0;i<31;i++){
  const code=String(1000+i),date="2026-08-20";
  for(const h of [1,3,5])data.push(row(code,date,h));
 }
 for(let i=0;i<3;i++)for(const h of [1,3,5])
  data.push(row(String(2000+i),"2026-09-10",h,-2));
 for(let i=0;i<2;i++)for(const h of [1,3,5])
  data.push(row(String(3000+i),"2026-09-03",h,-5));
 return data;
};
const report=rows=>evaluateCombinedResearch(rows,{
 baseOutcomes:rows.length,expansionOutcomes:0,
 verifiedBaseVolume:rows.length/3,factors:rows.length/3
});
const cell=(r,id,period,h=5)=>r.summaries.find(x=>
 x.group==="SQUEEZE_UP_BREAKOUT"&&x.horizon===h&&x.rule===id&&x.period===period);

test("time split is fixed and uses signal local date",()=>{
 assert.equal(signalLocalDate(ts("2026-08-31")),"2026-08-31");
 assert.equal(researchPeriod(ts("2026-08-31")),"EARLY");
 assert.equal(researchPeriod(ts("2026-09-03")),"EMBARGO");
 assert.equal(researchPeriod(ts("2026-09-08")),"LATE");
});
test("early and later mean/win rate are independent, with embargo excluded",()=>{
 const r=report(set());
 assert.equal(r.coverage.outcomes,108);
 assert.equal(r.coverage.signals,36);
 assert.equal(r.coverage.embargoEvents,2);
 assert.equal(cell(r,"BASELINE","EARLY").count,31);
 assert.equal(cell(r,"BASELINE","EARLY").positiveRate,1);
 assert.equal(cell(r,"BASELINE","LATE").count,3);
 assert.equal(cell(r,"BASELINE","LATE").positiveRate,null);
 assert.equal(cell(r,"BASELINE","ALL").count,34);
 assert.equal(cell(r,"BASELINE","ALL").meanReturnPercent,(31-6)/34);
});
test("rule membership is frozen, unaffected by any future return",()=>{
 const r=row("9984","2026-08-12",5,17);
 const s={...r,return_percent:-40,max_adverse_percent:-25};
 for(const rule of RULES)assert.equal(matchesResearchRule(r,rule.id),
   matchesResearchRule(s,rule.id));
 assert.equal(matchesResearchRule(r,"RSI50_70_VOLUME_HIGH"),true);
 assert.equal(matchesResearchRule(r,"BREAKOUT2_VOLUME_HIGH"),true);
 assert.equal(matchesResearchRule(r,"RSI70_VOLUME_HIGH"),false);
});
test("30-case minimum applies independently to each time period",()=>{
 assert.equal(MIN_SAMPLE,30);
 const rows=set().filter(x=>x.code!=="1030");
 const r=report(rows);
 assert.equal(cell(r,"BASELINE","EARLY").count,30);
 assert.equal(cell(r,"BASELINE","EARLY").qualified,true);
 const limited=rows.filter(x=>x.code!=="1029");
 const s=report(limited);
 assert.equal(cell(s,"BASELINE","EARLY").count,29);
 assert.equal(cell(s,"BASELINE","EARLY").qualified,false);
 assert.equal(cell(s,"BASELINE","EARLY").meanReturnPercent,null);
});
test("duplicate horizon, missing factors or outcome coverage fails closed",()=>{
 const x=set();
 assert.throws(()=>report([...x,x[0]]),/DUPLICATE_FROZEN_OUTCOME/);
 assert.throws(()=>report(x.map((r,i)=>i===0?{...r,rsi_group:null}:r)),
  /MISSING_OR_BAD_FACTOR/);
 assert.throws(()=>evaluateCombinedResearch(x,{baseOutcomes:x.length+1,
  expansionOutcomes:0,verifiedBaseVolume:36,factors:36}),/SOURCE_ROWS_MISSING/);
});
test("all 1+3+5 outcomes require one signal row each",()=>{
 const x=set().filter(r=>!(r.code==="1000"&&r.horizon===1));
 assert.throws(()=>evaluateCombinedResearch(x,{baseOutcomes:x.length,
  expansionOutcomes:0,verifiedBaseVolume:36,factors:36}),/MISSING_NEXT_DAY_SOURCE/);
});
test("owner-only API, read-only snapshot, no vendor call, no Cron, no DB migration",()=>{
 const route=readFileSync("app/api/admin/bollinger-breakout-shadow/combined/route.ts","utf8");
 const reader=readFileSync("app/lib/research/bollingerCombinedStudyReader.ts","utf8");
 const client=readFileSync("app/admin/bollinger-breakout-shadow/BollingerCombinedStudy.tsx","utf8");
 assert.ok(route.indexOf("getLearningOwnerSession")<route.indexOf("getCombinedBollingerStudy()"));
 assert.match(reader,/REPEATABLE READ READ ONLY/);
 assert.match(reader,/bb_breakout_volume_factors/);
 assert.match(reader,/original_source_hash/);
 assert.match(client,/30件未満/);
 assert.doesNotMatch(reader,/INSERT INTO|UPDATE public|DELETE FROM|DROP TABLE|fetch\(|getForwardCandles|\/api\/cron/i);
 assert.doesNotMatch(route,/POST|PUT|DELETE/);
});
