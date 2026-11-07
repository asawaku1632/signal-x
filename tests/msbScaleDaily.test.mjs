import assert from "node:assert/strict";
import test from "node:test";
import {readFileSync} from "node:fs";
import {
  chooseMsbUnseenStocks,MSB_SCALE_MAX_EXTRA_BATCHES,MSB_SCALE_MAX_TOTAL_STOCKS,
  MSB_SCALE_BATCH_SIZE,
} from "../app/lib/research/msbScalePolicy.ts";
const src=(path)=>readFileSync(new URL("../"+path,import.meta.url),"utf8");

test("50 target is first five shared plus nine independently bounded groups",()=>{
  assert.equal(MSB_SCALE_MAX_EXTRA_BATCHES,9);
  assert.equal(MSB_SCALE_BATCH_SIZE,5);
  assert.equal(MSB_SCALE_MAX_TOTAL_STOCKS,50);
  const universe=Array.from({length:130},(_,i)=>String(1300+i));
  const prev=new Set(universe.slice(0,5));
  const v=chooseMsbUnseenStocks({universe,covered:prev,extraBatches:9});
  assert.equal(v.length,45);
  assert.equal(new Set(v).size,45);
  assert.ok(v.every(x=>!prev.has(x)&&/^[0-9]{4}$/.test(x)));
  assert.deepEqual(v,chooseMsbUnseenStocks({universe,covered:prev,extraBatches:9}));
  assert.equal(chooseMsbUnseenStocks({universe,covered:prev,extraBatches:1}).length,5);
});

test("fail closed invalid caps, exhausted universe, repeated and malformed codes",()=>{
  const universe=["3182","3182","A123","12345","8306","8316","8473"];
  for(const x of [-1,10,1.5,NaN,Infinity])
    assert.deepEqual(chooseMsbUnseenStocks({universe,covered:new Set(),extraBatches:x}),[]);
  assert.deepEqual(chooseMsbUnseenStocks({universe,covered:new Set(),extraBatches:0}),[]);
  const v=chooseMsbUnseenStocks({universe,covered:new Set(["3182"]),extraBatches:9});
  assert.deepEqual([...v].sort(),["8306","8316","8473"]);
});

test("separate extra batch ledger is once per date+index, off by default, and private",()=>{
  const sql=src("supabase/migrations/20261108_create_msb_volume_scale_batches.sql");
  const executable=sql.replace(/^\s*--.*$/gm,"");
  assert.match(sql,/enabled boolean NOT NULL DEFAULT false/);
  assert.match(sql,/extra_batches smallint NOT NULL DEFAULT 0/);
  assert.match(sql,/PRIMARY KEY\(trade_date,batch_no\)/);
  assert.match(sql,/BETWEEN 0 AND 9/);
  assert.match(sql,/BETWEEN 1 AND 9/);
  assert.match(sql,/BETWEEN 1 AND 5/);
  assert.match(sql,/ENABLE ROW LEVEL SECURITY/g);
  assert.match(sql,/REVOKE ALL ON public\.msb_volume_scale_control,public\.msb_volume_scale_batches/);
  assert.doesNotMatch(executable,/\b(?:DROP|TRUNCATE|DELETE FROM|CREATE TRIGGER|CREATE POLICY)\b/i);
  assert.doesNotMatch(executable,/ALTER TABLE public\.(?!msb_volume_scale_)/i);
});

test("standard 5-stock horizontal flow remains unchanged and Cron is authenticated",()=>{
  const route=src("app/api/cron/horizontal-retest-research/route.ts");
  const horizontal=src("app/lib/research/horizontalAutoRunner.ts");
  const vercel=JSON.parse(src("vercel.json"));
  assert.match(route,/requireCronAuth\(request\)/);
  assert.ok(route.indexOf("requireCronAuth(request)")<route.indexOf("runHorizontalAutoDaily("));
  assert.match(route,/await runHorizontalAutoDaily\(new Date\(\),msbOn\)/);
  assert.match(route,/await tryScale\(msbOn&&horizontal\.success&&/);
  assert.match(route,/horizontal\.msb\?\.status==="COMPLETED"/);
  assert.match(route,/export const maxDuration=60/);
  assert.match(horizontal,/fetchCohort\(codes\)/);
  assert.match(horizontal,/runMsbAutoShared\(loaded, tradeDate\)/);
  assert.equal(vercel.crons.filter(x=>x.path==="/api/cron/horizontal-retest-research").length,1);
  assert.equal(vercel.crons.filter(x=>x.path.includes("msb")).length,0);
});

test("expansion requires base COMPLETED, fresh symbols, and claims before each Yahoo fetch",()=>{
  const runner=src("app/lib/research/msbScaleRunner.ts");
  const archive=src("app/lib/research/msbAutoRunner.ts");
  assert.match(runner,/MSB_SCALE_TIME_BUDGET_MS = 43_000/);
  assert.match(runner,/BASE_FIVE_NOT_COMPLETED/);
  assert.match(runner,/SELECT status FROM public\.msb_volume_auto_daily_runs/);
  assert.match(runner,/FROM public\.msb_volume_research_runs/);
  assert.match(runner,/FROM public\.msb_volume_auto_daily_runs/);
  assert.match(runner,/FROM public\.msb_volume_scale_batches/);
  assert.match(runner,/UNION ALL/);
  assert.match(runner,/ON CONFLICT\(trade_date,batch_no\) DO NOTHING/);
  assert.ok(runner.indexOf("VALUES($1::date,$2,$3::text[])")<runner.indexOf("fetchCohort(codes)"));
  assert.match(runner,/Date\.now\(\)-invocationStartedMs>=MSB_SCALE_TIME_BUDGET_MS/);
  assert.match(runner,/getMsbScaleExtraBatchLimit\(\)<batchNo/);
  assert.match(runner,/if\(!saved\.success\)/);
  assert.match(runner,/WHERE trade_date=\$1::date AND batch_no=\$2 AND status='CLAIMED'/);
  assert.match(archive,/archiveClaimedMsbBatch\(/);
  assert.match(archive,/extraBatch\?:number/);
  assert.match(archive,/UPDATE public\.msb_volume_scale_batches SET status='COMPLETED'/);
  assert.match(archive,/ON CONFLICT\(detector_version,volume_version,code,signal_time\) DO NOTHING/);
  assert.doesNotMatch(runner,/\b(?:sendLine|runScan|savePaperTrade|updateAiPower)\s*\(/);
});

test("owner-only kill switch, status UI, and 50k archive guard",()=>{
  const actions=src("app/admin/shadow-msb-ob-swing/archive/scale-actions.ts");
  const page=src("app/admin/shadow-msb-ob-swing/archive/page.tsx");
  assert.match(actions,/if\(!isOwner\)notFound\(\)/);
  assert.ok(actions.indexOf("await getLearningOwnerSession()")<actions.indexOf("UPDATE public.msb_volume_scale_control"));
  assert.match(actions,/enabled\?9:0/);
  assert.match(page,/action=\{setMsbScaleEnabled\}/);
  assert.match(page,/追加収集の直近実績/);
  assert.match(page,/scaleDays/);
  assert.match(page,/LIMIT 50001/);
  assert.match(page,/observations\.length>50000/);
  assert.doesNotMatch(page,/fetchCohort\(/);
});
