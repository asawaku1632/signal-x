import test from "node:test";
import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import {readFileSync} from "node:fs";
import {dirname,join} from "node:path";
import {fileURLToPath} from "node:url";
import {
  NECKLINE_FORWARD_VERSION,
  NECKLINE_FORWARD_CODES,
  NECKLINE_FORWARD_BATCH_COUNT,
  NECKLINE_FORWARD_BATCH_SIZE,
  NECKLINE_FORWARD_EARLIEST_DATE,
  selectFrozenNecklineCandidate,
  evaluateFrozenNecklineOutcome,
  necklineForwardQualitySummary,
} from "../app/lib/research/necklineForwardCore.mjs";
import {replayNecklineEntryRisk} from "../app/lib/research/necklineEntryRiskReplay.mjs";

const root=join(dirname(fileURLToPath(import.meta.url)),"..");
const read=path=>readFileSync(join(root,path),"utf8");
const time=(date)=>Date.parse(date+"T06:00:00+09:00")/1000;
function dayBars(){
 const last=time("2026-11-09");
 const bars=Array.from({length:44},(_,i)=>({
  time:last-(43-i)*86400,open:98,high:100,low:97,close:98,volume:1000,
 }));
 bars[27]={...bars[27],low:90,close:95};
 bars[34]={...bars[34],high:105,close:102};
 bars[41]={...bars[41],low:91,close:92};
 bars[42]={...bars[42],low:92,close:94};
 bars[43]={...bars[43],low:93,close:98};
 return bars;
}
const stock=(code,candles,last="2026-11-09",error=null)=>({
 code,candles,error,latestDate:last,attempts:1,source:"YAHOO_QUERY1_1D",
 barsSha256:error?null:createHash("sha256").update(JSON.stringify(candles)).digest("hex"),
});
test("only same-day first detection is frozen before next market open, never backfilled",()=>{
 const bars=dayBars();
 const fresh=selectFrozenNecklineCandidate(stock("7164",bars),"2026-11-09","2026-11-10");
 assert.ok(fresh);
 assert.equal(fresh.policyVersion,NECKLINE_FORWARD_VERSION);
 assert.equal(fresh.signalDate,"2026-11-09");
 assert.equal(fresh.observedPreopenDate,"2026-11-10");
 assert.equal(fresh.firstSeenTime,bars.at(-1).time);
 assert.equal(fresh.firstBottomTime,bars[27].time);
 assert.equal(fresh.secondBottomTime,bars[41].time);
 assert.equal(fresh.neckline,105);
 assert.equal(fresh.low1,90);
 assert.equal(fresh.low2,91);
 assert.deepEqual(fresh.inputBars,bars);
 assert.equal(NECKLINE_FORWARD_EARLIEST_DATE,"2026-11-09");
 const appended=[...bars,{time:bars.at(-1).time+86400,open:98,high:100,low:97,close:98,volume:1000}];
 assert.equal(selectFrozenNecklineCandidate(stock("7164",appended,"2026-11-10"),"2026-11-10","2026-11-11"),null);
 assert.equal(selectFrozenNecklineCandidate(stock("7164",bars,"2026-11-09"),"2026-11-08","2026-11-09"),null);
 assert.equal(selectFrozenNecklineCandidate(stock("7164",bars),"2026-11-09","2026-11-09"),null);
});
test("missing/stale OHLC fails closed and carries the exact missing codes into the audit",()=>{
 const good=stock("7164",dayBars());
 const stale=stock("3774",dayBars(),"2026-11-06");
 const failed=stock("3540",[],"", "HTTP_404");
 const report=necklineForwardQualitySummary([good,stale,failed],"2026-11-09");
 assert.deepEqual([report.requested,report.valid,report.missing,report.coverageComplete],[3,1,2,false]);
 assert.deepEqual(report.results.map(r=>r.state),["VALID","STALE","FAILED"]);
 assert.equal(report.results[2].error,"HTTP_404");
 assert.equal(selectFrozenNecklineCandidate(stale,"2026-11-09","2026-11-10"),null);
 assert.equal(selectFrozenNecklineCandidate(failed,"2026-11-09","2026-11-10"),null);
 assert.equal(selectFrozenNecklineCandidate({...good,barsSha256:"forged"},"2026-11-09","2026-11-10"),null);
});
test("outcomes need exact 3 and 5 exchange session dates, with no missing-session shortcuts",()=>{
 const bars=[
  {time:time("2026-11-09"),open:98,high:100,low:97,close:98},
  {time:time("2026-11-10"),open:100,high:105,low:98,close:104},
  {time:time("2026-11-11"),open:104,high:106,low:101,close:105},
  {time:time("2026-11-12"),open:105,high:106,low:100,close:103},
  {time:time("2026-11-13"),open:102,high:103,low:97,close:99},
  {time:time("2026-11-16"),open:99,high:101,low:95,close:100},
 ];
 const dates=["2026-11-10","2026-11-11","2026-11-12","2026-11-13","2026-11-16"];
 const day3=evaluateFrozenNecklineOutcome("2026-11-09",bars,dates,3);
 const day5=evaluateFrozenNecklineOutcome("2026-11-09",bars,dates,5);
 assert.equal(day3.entryDate,"2026-11-10");
 assert.equal(day3.exitDate,"2026-11-12");
 assert.equal(day3.entryOpen,100);
 assert.equal(day3.exitClose,103);
 assert.equal(day3.returnPercent,2.8);
 assert.equal(day5.entryOpen,100);
 assert.equal(day5.exitDate,"2026-11-16");
 assert.equal(day5.returnPercent,-0.2);
 assert.equal(day5.maxAdversePercent,-5);
 assert.equal(evaluateFrozenNecklineOutcome("2026-11-09",bars.filter(b=>b.time!==time("2026-11-12")),dates,5),null);
 assert.equal(evaluateFrozenNecklineOutcome("2026-11-09",bars.slice(0,4),dates,5),null);
 assert.equal(evaluateFrozenNecklineOutcome("2026-11-09",bars,dates,2),null);
});
test("15 freeze codes use exactly three disjoint 5-code batches; authenticated cron is preopen only",()=>{
 assert.equal(NECKLINE_FORWARD_CODES.length,15);
 assert.equal(new Set(NECKLINE_FORWARD_CODES).size,15);
 assert.equal(NECKLINE_FORWARD_BATCH_COUNT,3);
 assert.equal(NECKLINE_FORWARD_BATCH_SIZE,5);
 const vercel=JSON.parse(read("vercel.json"));
 const paths=vercel.crons.filter(c=>c.path.startsWith("/api/cron/neckline-forward-preopen"));
 assert.equal(paths.length,3);
 assert.deepEqual(paths.map(p=>p.schedule),["25 23 * * 0-4","35 23 * * 0-4","45 23 * * 0-4"]);
 const route=read("app/api/cron/neckline-forward-preopen/route.ts");
 const runner=read("app/lib/research/necklineForwardRunner.ts");
 assert.match(route,/requireCronAuth\(request\)/);
 assert.match(route,/runNecklineForwardPreopen\(Number\(raw\)\)/);
 assert.match(runner,/if\(minute<8\*60\+20\|\|minute>=8\*60\+55\)/);
 assert.match(runner,/isTseTradingDate\(today\)/);
 assert.match(runner,/ON CONFLICT \(run_date,batch\) DO NOTHING/);
 assert.match(runner,/clock_timestamp\(\) AT TIME ZONE 'Asia\/Tokyo'/);
 assert.match(runner,/firstSeenTime/);
 assert.match(runner,/o\.status='PENDING'/);
 assert.match(runner,/resolveTseTradingDatesAfter\(row\.signal_date,5\)/);
 assert.doesNotMatch(runner,/sendNotification|pushNotification|placeOrder|tradingOrder/);
});
test("manual exact replay snapshot is explicit, owner-protected, hashed and not relabeled forward",()=>{
 const post=read("app/api/admin/neckline-replay-snapshot/route.ts");
 const page=read("app/admin/neckline-entry-risk/page.tsx");
 const forward=read("app/admin/neckline-forward/page.tsx");
 const db=read("supabase/migrations/20261109_neckline_forward_preopen_and_replay_snapshots.sql");
 assert.ok(post.indexOf("if(!isOwner)")<post.indexOf("fetchNecklineStableCohort(codes)"));
 assert.match(post,/NECKLINE_MANUAL_SNAPSHOT_V1/);
 assert.match(post,/createHash\("sha256"\)/);
 assert.match(post,/INSERT INTO public\.neckline_replay_snapshots/);
 assert.match(page,/formAction="\/api\/admin\/neckline-replay-snapshot"/);
 assert.match(page,/snapshot\?\.cohort/);
 assert.match(page,/同じ元データ/);
 assert.match(forward,/getLearningOwnerSession/);
 assert.match(forward,/事前保存検証/);
 assert.match(db,/ne ck li ne|neckline_forward_candidates/);
 assert.match(db,/ENABLE ROW LEVEL SECURITY/g);
 assert.match(db,/NECKLINE_FROZEN_RECORD_IMMUTABLE/);
 assert.match(db,/BEFORE UPDATE OR DELETE ON public\.neckline_forward_candidates/);
 assert.match(db,/BEFORE UPDATE OR DELETE ON public\.neckline_replay_snapshots/);
 assert.match(db,/NECKLINE_OUTCOME_INVALID_TRANSITION/);
 assert.match(db,/REVOKE ALL ON TABLE public\.neckline_forward_candidates FROM PUBLIC, anon, authenticated/);
});
test("symbol clustering tracks independent codes, not pretending same-symbol events independent",()=>{
 const bars=dayBars();
 const out=replayNecklineEntryRisk([
  {code:"7164",candles:bars,error:null},
  {code:"3996",candles:bars,error:null},
 ],new Date("2026-11-10T08:30:00+09:00"));
 const balance=out.diagnostics.symbolBalance;
 assert.equal(balance.byScenario.length,3);
 const initial=balance.byScenario[0];
 assert.equal(initial.distinctCandidateSymbols,2);
 assert.equal(initial.maturedSymbols,0);
 assert.equal(initial.missingSymbols,2);
 assert.equal(initial.pooled5Mean,null);
 assert.equal(initial.equalSymbol5Mean,null);
 const page=read("app/components/analysis/NecklineLossDiagnostics.tsx");
 assert.match(page,/銘柄を均等にした平均/);
 assert.match(page,/同じ銘柄の候補が多すぎる影響/);
});
