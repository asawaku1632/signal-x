import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import test from "node:test";
import {replayProvenanceTop5Budget} from "../app/lib/research/winRateTop5BudgetReplay.mjs";

const weekdays=(date)=>{
  if(date==="2026-11-03")return false;
  const day=new Date(date+"T00:00:00Z").getUTCDay();
  return day!==0&&day!==6;
};
const shift=(date,n)=>new Date(Date.parse(date+"T00:00:00Z")+n*86400000).toISOString().slice(0,10);
const nextDate=(date)=>{for(let i=1;i<=10;i++){const d=shift(date,i);if(weekdays(d))return d;}throw Error("calendar");};
const clock=(date,time="07:00:00")=>date+"T"+time+"Z";

function fixture(){
  const codes=["1000","2000","3000","4000","5000","6000"];
  const prices=[4200,2000,1800,1700,1600,1500];
  const rows=[];
  const days=[];
  for(let k=0;k<30;k++){
    const date=shift("2026-09-01",k);
    if(weekdays(date)){days.push(date);if(days.length===10)break;}
  }
  for(let i=0;i<codes.length;i++){
    const code=codes[i],price=prices[i];
    for(let n=0;n<days.length;n++){
      const date=days[n],sourceDate=nextDate(date);
      const result=n<8?"WIN":"LOSE";
      const nextPrice=price*(result==="WIN"?1.03:0.97);
      rows.push({id:date+"-"+code,date,code,name:"Stock"+code,
        price,nextPrice,result,sourcePrice:nextPrice,
        changePercent:result==="WIN"?3:-3,
        sourceTradeDate:sourceDate,judgedResult:result,
        createdAt:clock(date),checkedAt:clock(sourceDate,"07:15:00"),
        recordedAt:clock(sourceDate,"07:16:00")});
    }
  }
  for(let i=0;i<codes.length;i++){
    rows.push({date:"2026-11-04",code:codes[i],name:"Stock"+codes[i],
      price:prices[i],createdAt:clock("2026-11-04","07:00:00"),
      result:"UNKNOWN",nextPrice:null,changePercent:null});
  }
  const run={trade_date:"2026-11-05",prior_date:"2026-11-04",
    status:"COMPLETE",finished_at:clock("2026-11-05","07:45:00"),
    results:[{date:"2026-11-05",code:"2000",complete:true,entries:[
      {time:"09:30",entryPrice:2050},
    ]}]};
  for(const [date,price] of [["2026-11-06",2140],["2026-11-10",2160],["2026-11-12",2090]]){
    rows.push({date,code:"2000",name:"Stock2000",price,
      createdAt:clock(date,"07:00:00"),result:"UNKNOWN"});
  }
  return {rows,runs:[run],now:"2026-11-16T10:00:00Z",
    isTradingDate:weekdays,budgetYen:380000};
}

test("the as-of top five is ranked BEFORE budget and uses one 100-share candidate",()=>{
  const r=replayProvenanceTop5Budget(fixture());
  assert.equal(r.archiveDays,1);
  assert.equal(r.eligibleSelections,1);
  assert.equal(r.recent[0].code,"2000");
  assert.equal(r.recent[0].rank,2);
  assert.equal(r.pairedCount,1);
  assert.equal(r.horizons.length,3);
  assert.equal(r.status,"INSUFFICIENT_REPLAY_EVIDENCE");
  assert.equal(r.horizons[0].positiveRate,null);
  assert.equal(r.horizons[0].avgNetYen100,null);
  assert.equal(r.recent[0].status,"COMPLETE");
});

test("future outcome, untraced row and checked-after-decision are not eligible to change ranks",()=>{
  const input=fixture();
  for(let n=0;n<30;n++){
    input.rows.push({date:"2026-09-01",code:"0001",name:"Hindsight",
      price:100,nextPrice:103,sourcePrice:103,sourceTradeDate:"2026-09-02",
      result:"WIN",changePercent:3,judgedResult:"WIN",
      createdAt:"2026-09-01T07:00:00Z",checkedAt:"2026-11-05T01:00:00Z",
      recordedAt:"2026-11-05T01:00:00Z"});
  }
  const r=replayProvenanceTop5Budget(input);
  assert.equal(r.recent[0].code,"2000");
  const x=fixture();
  const row=x.rows.find(r=>r.date==="2026-09-01"&&r.code==="2000");
  row.recordedAt=null;
  assert.notEqual(replayProvenanceTop5Budget(x).recent[0].code,"2000");
});

test("missing 09:30 price is not filled from another stock or prior close",()=>{
  const input=fixture();
  input.runs[0].results=[];
  const r=replayProvenanceTop5Budget(input);
  assert.equal(r.eligibleSelections,1);
  assert.equal(r.pairedCount,0);
  assert.equal(r.missingEntry,1);
  assert.equal(r.recent[0].status,"MISSING_ENTRY,MISSING_ENTRY,MISSING_ENTRY");
});

test("future prices are never used before the actual 1/3/5 JPX sessions mature",()=>{
  const input=fixture();
  input.now="2026-11-09T00:00:00Z";
  const r=replayProvenanceTop5Budget(input);
  assert.equal(r.pairedCount,0);
  assert.equal(r.recent[0].status,"PENDING,PENDING");
});

test("100-share budget must also hold at later hypothetical 09:30 entry",()=>{
  const input=fixture();
  input.runs[0].results[0].entries[0].entryPrice=4000;
  const r=replayProvenanceTop5Budget(input);
  assert.equal(r.pairedCount,0);
  assert.equal(r.recent[0].status,"ENTRY_OVER_BUDGET,ENTRY_OVER_BUDGET,ENTRY_OVER_BUDGET");
});

test("reject a bad policy before reading the archive",()=>{
  assert.throws(()=>replayProvenanceTop5Budget({...fixture(),budgetYen:999999}),/INVALID_REPLAY_POLICY/);
});

test("admin replay is read-only, access controlled, and not wired to live rankings",()=>{
  const page=readFileSync("app/admin/stock-win-rate-ranking/forward/page.tsx","utf8");
  const client=readFileSync("app/admin/stock-win-rate-ranking/AdminWinRateRankingClient.tsx","utf8");
  const code=readFileSync("app/lib/research/winRateTop5BudgetReplay.mjs","utf8");
  assert.match(page,/getAdminSession\(\)/);
  assert.match(page,/if\(!isAdmin\)notFound\(\)/);
  assert.match(page,/daily_result_price_provenance/);
  assert.match(page,/entry_time_shadow_runs/);
  assert.match(page,/replayProvenanceTop5Budget/);
  assert.match(client,/\/admin\/stock-win-rate-ranking\/forward/);
  assert.doesNotMatch(page+code,/\bINSERT\b|\bUPDATE\b|\bDELETE\b|\bfetch\(/);
});
