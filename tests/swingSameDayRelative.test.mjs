import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {
 summarizeSameDayRelative,SAME_DAY_RELATIVE_VERSION,
 SAME_DAY_HORIZONS,SAME_DAY_BANDS,SAME_DAY_MIN_CONCLUSIVE_DAYS
} from "../app/lib/learning/swingSameDayRelative.ts";

const make=(trade_date,days,group_key,recorded,checked,up_count,avg_return)=>({
 trade_date,days,group_key,
 recorded:String(recorded),checked:String(checked),
 up_count:String(up_count),avg_return:avg_return==null?null:String(avg_return)
});
const d1="2026-10-08",d2="2026-10-09",d3="2026-10-13";
const base=[
 make(d1,5,"ALL",950,950,520,1),
 make(d1,5,"0-19",100,100,75,10),
 make(d1,5,"CANDIDATE",100,100,50,2),
 make(d1,5,"WAIT",100,100,40,1),
 make(d1,5,"WATCH",100,100,60,4),
 make(d2,5,"ALL",950,950,420,0),
 make(d2,5,"0-19",20,20,2,-4),
 make(d2,5,"CANDIDATE",100,100,50,-3),
 make(d2,5,"WAIT",100,40,21,3), // incomplete peer, must be omitted
 make(d2,5,"WATCH",100,100,52,-5)
];
const get=(rows,band="0-19",days=5)=>summarizeSameDayRelative(rows).find(x=>x.band===band&&x.days===days);

test("same-date equal-weight mean avoids false weighting by stock counts",()=>{
 const stats=get(base);
 assert.equal(stats.matchedDates,2);
 assert.equal(stats.stockDays,120);
 assert.equal(stats.universeStockDays,1900);
 assert.equal(stats.bandMeanPct,3); // (10+-4)/2, NOT (100*10+20*-4)/120
 assert.equal(stats.universeMeanPct,0.5);
 assert.equal(stats.excessPctPoints,2.5);
 assert.equal(stats.beatUniverseDays,1);
 assert.equal(stats.bandUpRate,42.5); // mean of 75% and 10% (daily equal weights)
 assert.equal(stats.daily.length,2);
 assert.deepEqual(stats.daily.map(x=>x.date),[d2,d1]);
 assert.equal(stats.conclusive,false);
 assert.equal(SAME_DAY_MIN_CONCLUSIVE_DAYS,10);
});
test("each other decision status is compared on the same eligible dates",()=>{
 const stats=get(base);
 const peers=new Map(stats.peers.map(x=>[x.groupKey,x]));
 assert.equal(peers.get("CANDIDATE").matchedDates,2);
 assert.equal(peers.get("CANDIDATE").peerMeanPct,-0.5);
 assert.equal(peers.get("CANDIDATE").excessPctPoints,3.5);
 assert.equal(peers.get("WAIT").matchedDates,1);
 assert.equal(peers.get("WAIT").peerMeanPct,1);
 assert.equal(peers.get("WAIT").excessPctPoints,9);
 assert.equal(peers.get("WATCH").matchedDates,2);
 assert.equal(peers.get("WATCH").excessPctPoints,3.5);
});
test("missing future prices never become zero wins/losses or valid comparisons",()=>{
 const rows=[...base,make(d3,5,"ALL",950,0,0,null),
   make(d3,5,"0-19",50,0,0,null)];
 assert.equal(get(rows).matchedDates,2);
 assert.equal(get(rows).stockDays,120);
 const missing=get(rows,"0-19",10);
 assert.equal(missing.matchedDates,0);
 assert.equal(missing.excessPctPoints,null);
 assert.equal(missing.bandUpRate,null);
 assert.equal(missing.beatUniverseDays,0);
});
test("full universe >=800 and >=80% matched-price coverage are mandatory",()=>{
 assert.equal(get([make(d1,5,"ALL",790,790,300,1),
   make(d1,5,"0-19",30,30,20,4)]).matchedDates,0);
 assert.equal(get([make(d1,5,"ALL",950,700,300,1),
   make(d1,5,"0-19",30,30,20,4)]).matchedDates,0);
 assert.equal(get([make(d1,5,"ALL",950,950,300,1),
   make(d1,5,"0-19",30,20,10,4)]).matchedDates,0);
 assert.equal(get([make(d1,5,"ALL",950,950,300,1),
   make(d1,5,"0-19",5,4,2,4)]).matchedDates,1);
});
test("incomplete other statuses are not swapped with a result from a different day",()=>{
 const rows=[...base.filter(x=>x.group_key!=="CANDIDATE"),
   make(d3,5,"CANDIDATE",100,100,50,10)];
 const peers=get(rows).peers.find(x=>x.groupKey==="CANDIDATE");
 assert.equal(peers.matchedDates,0);
 assert.equal(peers.excessPctPoints,null);
});
test("invalid/duplicate/contradictory source rows never inflate evidence",()=>{
 const rows=[...base,
  base[0], // duplicate
  make("bad",5,"ALL",950,950,500,10),
  make(d3,5,"ALL",950,970,500,10),
  make(d3,5,"0-19",40,40,50,4)];
 assert.equal(get(rows).matchedDates,2);
});
test("never mix future horizons, always return exactly four bands times four periods",()=>{
 const rows=[...base,make(d1,3,"ALL",950,950,600,4),
  make(d1,3,"0-19",100,100,60,5)];
 const all=summarizeSameDayRelative(rows);
 assert.equal(all.length,16);
 assert.deepEqual(SAME_DAY_HORIZONS,[1,3,5,10]);
 assert.deepEqual(SAME_DAY_BANDS.map(x=>x.key),["0-19","20-39","40-54","55-64"]);
 assert.equal(get(rows,"0-19",5).matchedDates,2);
 assert.equal(get(rows,"0-19",3).matchedDates,1);
 assert.equal(get(rows,"20-39",3).matchedDates,0);
 assert.match(SAME_DAY_RELATIVE_VERSION,/SAME_DAY/);
});
test("conclusive gate requires >=10 unique eligible dates, not many stocks",()=>{
 const rows=[];
 for(let i=0;i<10;i++){
   const date="2026-10-"+String(i+1).padStart(2,"0");
   rows.push(make(date,1,"ALL",950,950,500,1));
   rows.push(make(date,1,"55-64",30,30,15,3));
 }
 assert.equal(get(rows,"55-64",1).matchedDates,10);
 assert.equal(get(rows,"55-64",1).conclusive,true);
});
test("SQL is read-only from frozen per-date results; page shows explicit benchmark limits",()=>{
 const server=readFileSync("app/lib/learning/swingUniverseAudit.ts","utf8");
 const ui=readFileSync("app/simulation/universe-check/page.tsx","utf8");
 assert.match(server,/sameDayComparison: summarizeSameDayRelative\(sameDayRows.rows\)/);
 assert.match(server,/WHERE obs.rule_version=\$1/);
 assert.match(server,/obs.trade_date>=/);
 assert.match(server,/VALUES \(1, obs.return_1d\), \(3, obs.return_3d\)/);
 assert.match(server,/\(5, obs.return_5d\), \(10, obs.return_10d\)/);
 assert.match(server,/\('ALL'::text\)/);
 assert.match(server,/ROUND\(AVG\(return_pct\),6\)/);
 assert.doesNotMatch(server,/UPDATE\s+public\.swing_universe_observations\s+SET\s+decision_status/i);
 assert.match(ui,/report.sameDayComparison.filter/);
 assert.match(ui,/日経平均・TOPIXの騰落率ではありません/);
 assert.match(ui,/各80%以上完了/);
 assert.match(ui,/全銘柄平均には対象帯の銘柄も含まれます/);
 assert.match(ui,/判定日が10日未満/);
});
