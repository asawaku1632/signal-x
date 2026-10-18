import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const page=readFileSync(new URL("../app/admin/crash-strength/page.tsx",import.meta.url),"utf8");
const tabs=readFileSync(new URL("../app/admin/crash-strength/CrashStrengthDashboardTabs.tsx",import.meta.url),"utf8");

test("dashboard includes all five distinct views with sticky keyboard-accessible buttons",()=>{
  assert.match(tabs,/use client/);
  for(const tab of ["概要","暴落翌日","市場比較","当日強弱","注意点"])assert.ok(tabs.includes(tab));
  for(const key of ["overview","nextday","market","intraday","notes"])assert.ok(tabs.includes(key));
  assert.match(tabs,/sticky top-0/);
  assert.match(tabs,/onClick=\{\(\)=>setActive\(tab\.id\)\}/);
  assert.match(tabs,/role="tablist"/);
  assert.match(tabs,/aria-selected/);
  assert.match(tabs,/role="tabpanel"/);
  assert.match(tabs,/panels\[active\]/);
});
test("all research views share server-only owner-gated read with no extra provider/DB requests",()=>{
  assert.ok(page.indexOf("if (!isOwner) notFound()")<page.indexOf("await getReport()"));
  assert.equal((page.match(/await getReport\(\)/g)||[]).length,1);
  assert.match(page,/overview=\{/);
  assert.match(page,/nextday=\{/);
  assert.match(page,/market=\{/);
  assert.match(page,/intraday=\{/);
  assert.match(page,/notes=\{/);
  assert.match(page,/NextDayEvidence/);
  assert.match(page,/BenchmarkEvidenceList/);
  assert.match(page,/ReplayStatus/);
  assert.match(page,/BottomNav/);
  assert.doesNotMatch(page+tabs,/INSERT INTO|UPDATE public\.|DELETE FROM|sendLine|createOrder/);
});
test("rankings show three rows first and preserve all remaining rows under explicit expanders",()=>{
  for(const helper of ["CompactBenchmark","CompactNextDay","CompactStock"])assert.ok(page.includes("function "+helper));
  assert.ok((page.match(/rows\.slice\(0,3\)/g)||[]).length>=3);
  assert.ok((page.match(/<details /g)||[]).length>=4);
  assert.match(page,/もっと見る（全/);
  assert.match(page,/除外例/);
  assert.match(page,/5取引日後/);
});
