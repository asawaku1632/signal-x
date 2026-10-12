import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import {
  SHADOW_CANDLE_AUTO_MAX_STOCKS,
  SHADOW_CANDLE_AUTO_UTC_SCHEDULE,
  selectShadowAutoDailyStocks,
} from "../app/lib/research/shadowCandleAutoPolicy.ts";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const universe = ["3182","3387","6855","7203","9984","8306","6758","6098","9432","6501","7011","4502"];

test("JPX holiday, weekend and unknown calendar dates NEVER schedule Yahoo or a DB claim", () => {
  for (const iso of [
    "2026-10-11T23:35:00Z", // 10/12 holiday 08:35 JST
    "2026-10-09T23:35:00Z", // 10/10 Saturday 08:35 JST
    "2026-10-10T23:35:00Z", // 10/11 Sunday 08:35 JST
  ]) {
    const result = selectShadowAutoDailyStocks({now:new Date(iso),universe,coveredCodes:new Set()});
    assert.equal(result.ok,false,iso);
    assert.equal(result.reason,"MARKET_CLOSED");
  }
  const unknown=selectShadowAutoDailyStocks({
    now:new Date("2028-01-02T23:35:00Z"),universe,coveredCodes:new Set(),
  });
  assert.equal(unknown.ok,false);
  assert.equal(unknown.reason,"CALENDAR_UNKNOWN");
});

test("next normal trading day 2026/10/13 permits max-five only during 08:30-09:00 JST", () => {
  const tooEarly=selectShadowAutoDailyStocks({
    now:new Date("2026-10-12T23:25:00Z"),universe,coveredCodes:new Set(),
  });
  assert.equal(tooEarly.ok,false);
  assert.equal(tooEarly.reason,"OUTSIDE_MORNING_WINDOW");
  const ready=selectShadowAutoDailyStocks({
    now:new Date("2026-10-12T23:35:00Z"),universe,coveredCodes:new Set(),
  });
  assert.equal(ready.ok,true);
  assert.equal(ready.dateJst,"2026-10-13");
  assert.equal(ready.codes.length,5);
  const after=selectShadowAutoDailyStocks({
    now:new Date("2026-10-13T00:00:00Z"),universe,coveredCodes:new Set(),
  });
  assert.equal(after.ok,false);
  assert.equal(after.reason,"OUTSIDE_MORNING_WINDOW");
  assert.equal(SHADOW_CANDLE_AUTO_MAX_STOCKS,5);
});

test("ten manually archived codes are never selected and stable order is reproducible", () => {
  const manual=new Set(["3182","3387","6855","7203","9984","8306","6758","6098","9432","6501"]);
  const args={now:new Date("2026-10-12T23:35:00Z"),universe,coveredCodes:manual};
  const result=selectShadowAutoDailyStocks(args);
  const same=selectShadowAutoDailyStocks(args);
  assert.deepEqual(result,same);
  assert.equal(result.ok,true);
  assert.deepEqual(new Set(result.codes).size,result.codes.length);
  assert.ok(result.codes.every(code=>!manual.has(code)));
  assert.equal(result.codes.length,2);
});

test("no eligible stocks never retries covered codes", () => {
  const result=selectShadowAutoDailyStocks({
    now:new Date("2026-10-12T23:35:00Z"),universe,coveredCodes:new Set(universe),
  });
  assert.equal(result.ok,false);
  assert.equal(result.reason,"NO_ELIGIBLE_STOCKS");
});

test("cron uses fail-closed auth, activation switch, market preflight before DB access", () => {
  const source=read("app/api/cron/shadow-candle-research/route.ts");
  assert.match(source,/CRON_SECRET/);
  assert.match(source,/request\.headers\.get\("authorization"\)/);
  assert.match(source,/getShadowAutoSwitch/);
  assert.match(source,/selectShadowAutoDailyStocks/);
  const auth=source.indexOf("if (!authorized(request))");
  const preflight=source.indexOf("const preflight = selectShadowAutoDailyStocks");
  const toggle=source.indexOf("await getShadowAutoSwitch()");
  const run=source.indexOf("await runShadowCandleAutoDaily()");
  assert.ok(auth >= 0 && preflight > auth && toggle > preflight && run > toggle);
  assert.doesNotMatch(source,/sendLine|runScan\(/);
});

test("unique DB date claim precedes any Yahoo fetch; no repeat on failure or provider outage", () => {
  const source=read("app/lib/research/shadowCandleAutoRunner.ts");
  const claim=source.indexOf("INSERT INTO public.shadow_candle_auto_daily_runs");
  const fetch=source.indexOf("await fetchCohort(codes)");
  assert.ok(claim > 0 && fetch > claim);
  assert.match(source,/ON CONFLICT \(trade_date\) DO NOTHING/);
  assert.match(source,/ALREADY_CLAIMED/);
  assert.match(source,/status='FAILED'/);
  assert.doesNotMatch(source,/\b(?:DELETE FROM|TRUNCATE|sendLine|runScan\(|updateAiPower\()/i);
  assert.match(source,/UNION ALL/);
  assert.match(source,/SELECT unnest\(codes\) AS code FROM public\.shadow_candle_research_runs/);
});

test("schema protects daily one-time cap with PRIMARY KEY and RLS", () => {
  const sql=read("supabase/migrations/20261012_create_shadow_candle_auto_daily_runs.sql");
  assert.match(sql,/trade_date date PRIMARY KEY/);
  assert.match(sql,/cardinality\(codes\) BETWEEN 1 AND 5/);
  assert.match(sql,/ENABLE ROW LEVEL SECURITY/i);
  assert.match(sql,/REVOKE ALL ON TABLE public\.shadow_candle_auto_daily_runs FROM public, anon, authenticated/);
  const executableSql = sql.replace(/^\s*--.*$/gm, "");
  assert.doesNotMatch(executableSql,/\b(?:DROP|TRUNCATE|DELETE|ALTER TABLE public\.shadow_candle_research_runs)\b/i);
});

test("scheduler is only one invocation on JST trading weekday mornings", () => {
  const config=JSON.parse(read("vercel.json"));
  const jobs=config.crons.filter(c=>c.path==="/api/cron/shadow-candle-research");
  assert.equal(jobs.length,1);
  assert.equal(jobs[0].schedule,SHADOW_CANDLE_AUTO_UTC_SCHEDULE);
  assert.equal(jobs[0].schedule,"35 23 * * 0-4");
});

test("owner-controlled switch is OFF by default, private and cannot affect live AI", () => {
  const sql=read("supabase/migrations/20261012_create_shadow_candle_auto_control.sql");
  assert.match(sql,/enabled boolean NOT NULL DEFAULT false/);
  assert.match(sql,/ENABLE ROW LEVEL SECURITY/i);
  assert.match(sql,/REVOKE ALL ON public\.shadow_candle_auto_control FROM public, anon, authenticated/);
  assert.match(sql,/VALUES \(true, false\) ON CONFLICT \(id\) DO NOTHING/);
  const action=read("app/admin/shadow-candlestick-nine/archive/actions.ts");
  const auth=action.indexOf("await getLearningOwnerSession()");
  const update=action.indexOf("UPDATE public.shadow_candle_auto_control");
  assert.ok(auth >= 0 && update > auth);
  assert.match(action,/if \(!isOwner\) notFound\(\)/);
  assert.match(action,/choice !== "on" && choice !== "off"/);
  assert.doesNotMatch(action,/runScan|sendLine|saveDailyStocks/);
  const archive=read("app/admin/shadow-candlestick-nine/archive/page.tsx");
  assert.match(archive,/action=\{setShadowAutoEnabled\}/);
  assert.match(archive,/autoEnabled \? "off" : "on"/);
});
