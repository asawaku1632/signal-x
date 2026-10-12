import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import {
  HORIZONTAL_AUTO_MAX_STOCKS,
  HORIZONTAL_AUTO_UTC_SCHEDULE,
  selectHorizontalAutoDailyStocks,
} from "../app/lib/research/horizontalAutoPolicy.ts";
const read=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
const universe=["3182","3387","6855","7203","9984","1605","2760","3994","5805","8058","8306","9432","6758","A123","12345","3182"];

test("JPX closed/unknown dates never schedule any stock HTTP",()=>{
  for(const d of ["2026-10-11T23:50:00Z","2026-10-09T23:50:00Z","2026-10-10T23:50:00Z"]){
    const o=selectHorizontalAutoDailyStocks({now:new Date(d),universe,coveredCodes:new Set()});
    assert.equal(o.ok,false);
    assert.equal(o.reason,"MARKET_CLOSED");
  }
  const unknown=selectHorizontalAutoDailyStocks({
    now:new Date("2028-01-02T23:50:00Z"),universe,coveredCodes:new Set(),
  });
  assert.equal(unknown.ok,false);
  assert.equal(unknown.reason,"CALENDAR_UNKNOWN");
});

test("JPX open day after fixed 08:40 cutoff selects up to 5 unseen 4-digit stocks",()=>{
  const base={universe,coveredCodes:new Set(["3182","3387"])};
  const early=selectHorizontalAutoDailyStocks({...base,now:new Date("2026-10-12T23:39:00Z")});
  assert.equal(early.ok,false);
  assert.equal(early.reason,"OUTSIDE_MORNING_WINDOW");
  const result=selectHorizontalAutoDailyStocks({...base,now:new Date("2026-10-12T23:50:00Z")});
  assert.equal(result.ok,true);
  assert.equal(result.dateJst,"2026-10-13");
  assert.equal(result.codes.length,5);
  assert.equal(new Set(result.codes).size,5);
  assert.ok(result.codes.every(c=>/^[0-9]{4}$/.test(c) && !base.coveredCodes.has(c)));
  assert.deepEqual(result,selectHorizontalAutoDailyStocks({...base,now:new Date("2026-10-12T23:50:00Z")}));
  const late=selectHorizontalAutoDailyStocks({...base,now:new Date("2026-10-13T00:01:00Z")});
  assert.equal(late.ok,false);
  assert.equal(late.reason,"OUTSIDE_MORNING_WINDOW");
  assert.equal(HORIZONTAL_AUTO_MAX_STOCKS,5);
});

test("all earlier manual/auto-attempt covered stocks are never selected again",()=>{
  const o=selectHorizontalAutoDailyStocks({
    now:new Date("2026-10-12T23:50:00Z"),
    universe,coveredCodes:new Set(universe.filter(x=>/^[0-9]{4}$/.test(x))),
  });
  assert.equal(o.ok,false);
  assert.equal(o.reason,"NO_ELIGIBLE_STOCKS");
});

test("cron is authenticated first and requires owner's ON switch before any Yahoo call",()=>{
  const c=read("app/api/cron/horizontal-retest-research/route.ts");
  const auth=c.indexOf("requireCronAuth(request)");
  const pre=c.indexOf("selectHorizontalAutoDailyStocks({");
  const enabled=c.indexOf("await getHorizontalAutoEnabled()");
  const run=c.indexOf("await runHorizontalAutoDaily()");
  assert.ok(auth>0 && auth<pre && pre<enabled && enabled<run);
  assert.match(c,/FEATURE_DISABLED/);
  assert.match(c,/maxDuration=60/);
  assert.doesNotMatch(c,/\b(?:runScan|sendLine|saveDailyStocks|notifyUser)\s*\(/);
});

test("DB one-time claim precedes market data fetch and failed claims never retry",()=>{
  const s=read("app/lib/research/horizontalAutoRunner.ts");
  assert.ok(s.indexOf("INSERT INTO public.horizontal_retest_auto_daily_runs") <
    s.indexOf("await fetchCohort(codes)"));
  assert.match(s,/ON CONFLICT \(trade_date\) DO NOTHING/);
  assert.match(s,/ALREADY_CLAIMED/);
  assert.match(s,/status='FAILED'/);
  assert.match(s,/DATA_UNAVAILABLE/);
  assert.match(s,/UNION ALL/);
  assert.match(s,/SELECT unnest\(codes\) AS code FROM public.horizontal_retest_archive_runs/);
  assert.match(s,/SELECT unnest\(codes\) AS code FROM public.horizontal_retest_auto_daily_runs/);
  assert.match(s,/ON CONFLICT \(detector_version,code,breakout_time,retest_time,entry_time\) DO NOTHING/);
  assert.match(s,/await client.query\("BEGIN"\)/);
  assert.match(s,/await client.query\("COMMIT"\)/);
  assert.doesNotMatch(s,/\b(?:DELETE FROM|TRUNCATE|runScan|sendLine|updateAiPower)\s*\(/i);
});

test("auto switch default OFF, RLS, limited roles; ledger daily PK, no production DDL",()=>{
  const sql=read("supabase/migrations/20261012_create_horizontal_retest_auto_control_daily.sql");
  assert.match(sql,/enabled boolean NOT NULL DEFAULT false/);
  assert.match(sql,/trade_date date PRIMARY KEY/);
  assert.match(sql,/cardinality\(codes\) BETWEEN 1 AND 5/);
  assert.match(sql,/ALTER TABLE public.horizontal_retest_auto_control ENABLE ROW LEVEL SECURITY/);
  assert.match(sql,/ALTER TABLE public.horizontal_retest_auto_daily_runs ENABLE ROW LEVEL SECURITY/);
  assert.match(sql,/REVOKE ALL .* FROM PUBLIC, anon, authenticated/);
  assert.match(sql,/ON CONFLICT \(id\) DO NOTHING/);
  const executable=sql.replace(/^\s*--.*$/gm,"");
  assert.doesNotMatch(executable,/\b(?:DROP|TRUNCATE|DELETE)\b|ALTER TABLE public\.(?!horizontal_retest_auto_)/i);
});

test("one Cron invocation, separated from existing candle daily at 08:35 JST",()=>{
  const cfg=JSON.parse(read("vercel.json"));
  const jobs=cfg.crons.filter(c=>c.path==="/api/cron/horizontal-retest-research");
  assert.equal(jobs.length,1);
  assert.equal(jobs[0].schedule,HORIZONTAL_AUTO_UTC_SCHEDULE);
  assert.equal(jobs[0].schedule,"50 23 * * 0-4");
  const candles=cfg.crons.find(c=>c.path==="/api/cron/shadow-candle-research");
  assert.equal(candles?.schedule,"35 23 * * 0-4");
});

test("owner-only switch and history page show explicit stop control and no GET market fetch",()=>{
  const page=read("app/admin/horizontal-retest/archive/page.tsx");
  const action=read("app/admin/horizontal-retest/archive/actions.ts");
  const owner=action.indexOf("await getLearningOwnerSession()");
  const update=action.indexOf("UPDATE public.horizontal_retest_auto_control");
  assert.ok(owner>0 && update>owner);
  assert.match(action,/if \(!isOwner\) notFound\(\)/);
  assert.match(action,/choice!=="on" && choice!=="off"/);
  assert.match(page,/action=\{setHorizontalAutoEnabled\}/);
  assert.match(page,/autoEnabled \? "off" : "on"/);
  assert.match(page,/horizontal_retest_auto_daily_runs/);
  assert.match(page,/if \(!isOwner\) notFound\(\)/);
  assert.doesNotMatch(page,/\bfetchCohort\s*\(/);
});
