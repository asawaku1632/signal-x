import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { selectHorizontalAutoDailyStocks } from "../app/lib/research/horizontalAutoPolicy.ts";
const read = (p) => readFileSync(new URL("../"+p,import.meta.url),"utf8");
const day = "2026-10-13T00:00:00Z"; // 09:00 JST, just outside 08:40–09:00
const valid = new Date("2026-10-12T23:50:00Z"); // Tue Oct 13 08:50 JST

test("one existing cron and five-bar upper bound remain unchanged",()=>{
  const vercel=JSON.parse(read("vercel.json"));
  const route=read("app/api/cron/horizontal-retest-research/route.ts");
  const horizontal=read("app/lib/research/horizontalAutoRunner.ts");
  const auto=read("app/lib/research/msbAutoRunner.ts");
  assert.equal(vercel.crons.filter(c=>c.path==="/api/cron/horizontal-retest-research").length,1);
  assert.equal(vercel.crons.filter(c=>c.path.includes("msb")).length,0);
  assert.match(route,/requireCronAuth\(request\)/);
  assert.match(route,/runHorizontalAutoDaily\(new Date\(\),msbOn\)/);
  assert.match(route,/runMsbAutoSolo\(\)/);
  assert.match(horizontal,/runMsbAutoShared\(loaded, tradeDate\)/);
  assert.ok(horizontal.indexOf("const loaded: LoadedStock[] = await fetchCohort(codes)")<
    horizontal.indexOf("runMsbAutoShared(loaded, tradeDate)"));
  assert.doesNotMatch(auto.slice(auto.indexOf("export async function runMsbAutoShared"),auto.indexOf("export async function runMsbAutoSolo")),/fetchCohort\(/);
  assert.match(auto,/const claimed=await claimMsbDaily\(decision.dateJst,decision.codes,"SOLO"\)/);
  assert.ok(auto.indexOf('claimMsbDaily(decision.dateJst,decision.codes,"SOLO")') <
    auto.lastIndexOf("const loaded=await fetchCohort(decision.codes)"));
});

test("reuse existing calendar, stable 5-stock selection and no trading outside morning window",()=>{
  const universe=Array.from({length:20},(_,i)=>String(1300+i));
  const eligible=selectHorizontalAutoDailyStocks({
    now:valid,universe,coveredCodes:new Set(universe.slice(0,3)),
  });
  assert.equal(eligible.ok,true);
  if(!eligible.ok)return;
  assert.equal(eligible.codes.length,5);
  assert.ok(eligible.codes.every(c=>!universe.slice(0,3).includes(c)));
  const repeat=selectHorizontalAutoDailyStocks({now:valid,universe,coveredCodes:new Set(universe.slice(0,3))});
  assert.deepEqual(eligible,repeat);
  const outside=selectHorizontalAutoDailyStocks({now:new Date(day),universe,coveredCodes:new Set()});
  assert.equal(outside.ok,false);
});

test("daily claims, fail closed and research-only permissions",()=>{
  const migration=read("supabase/migrations/20261012_create_msb_volume_auto_daily.sql");
  const auto=read("app/lib/research/msbAutoRunner.ts");
  const store=read("app/admin/shadow-msb-ob-swing/archive/actions.ts");
  const view=read("app/admin/shadow-msb-ob-swing/archive/page.tsx");
  const switcher=read("app/lib/research/msbAutoSwitch.ts");
  assert.match(migration,/enabled boolean NOT NULL DEFAULT false/);
  assert.match(migration,/trade_date date PRIMARY KEY/);
  assert.match(migration,/ENABLE ROW LEVEL SECURITY/g);
  assert.match(migration,/REVOKE ALL.*PUBLIC,anon,authenticated/);
  assert.match(auto,/ON CONFLICT\(trade_date\) DO NOTHING/);
  assert.match(auto,/ON CONFLICT\(detector_version,volume_version,code,signal_time\) DO NOTHING/);
  assert.match(auto,/WHERE trade_date=\$1::date AND status='CLAIMED'/);
  assert.match(auto,/DATA_UNAVAILABLE/);
  assert.match(auto,/RUN_ERROR/);
  assert.match(switcher,/rows\[0\]\?\.enabled===true/);
  assert.ok(store.indexOf("if(!isOwner)notFound()")<store.indexOf("await pool.query("));
  assert.ok(view.indexOf("if(!isOwner)notFound()")<view.indexOf("pool.query"));
  assert.match(view,/MSB・OBの自動研究を停止する/);
  assert.doesNotMatch(migration.replace(/^\s*--.*$/gm, ""),/\b(?:DELETE|DROP TABLE|CREATE TRIGGER|CREATE POLICY|TRUNCATE)\b/i);
  assert.doesNotMatch(auto+store,/\b(?:runScan|sendLine|calculateAiScore|savePaperTrade)\s*\(/);
});

test("research auto remains isolated and does not change production schedule or training",()=>{
  const route=read("app/api/cron/horizontal-retest-research/route.ts");
  const horizontal=read("app/lib/research/horizontalAutoRunner.ts");
  assert.match(route,/if\(!horizontalOn&&!msbOn\)/);
  assert.match(route,/if\(horizontalOn\)/);
  assert.match(horizontal,/catch \(e\) \{ console.error\("isolated MSB research failed",e\); \}/);
  assert.doesNotMatch(route+horizontal,/\/api\/learning\/save-daily|\/api\/cron\/daily-learning|sendLine|savePaperTrade/);
});
