import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const page=readFileSync(new URL("../app/admin/crash-strength/page.tsx",import.meta.url),"utf8");
const tabs=readFileSync(new URL("../app/admin/crash-strength/CrashStrengthDashboardTabs.tsx",import.meta.url),"utf8");
const cards=readFileSync(new URL("../app/admin/crash-strength/CrashBenchmarkCards.tsx",import.meta.url),"utf8");

test("approved mockup: four KPIs in a single mobile row without fifth overflow card",()=>{
  assert.match(page,/aria-label="研究サマリー"/);
  assert.match(page,/grid grid-cols-4/);
  for(const label of ["急落日","日経平均","判定対象","有効保存日"])assert.ok(page.includes('label:"'+label+'"'));
  assert.equal((page.match(/label:"除外"/g)||[]).length,0);
});

test("approved mockup: all five named tabs fit the screen, not horizontal-scroll clipping",()=>{
  assert.match(tabs,/grid grid-cols-5 gap-1/);
  assert.match(tabs,/min-w-0 whitespace-nowrap/);
  assert.doesNotMatch(tabs,/min-w-\[82px\]|overflow-x-auto|shrink-0 rounded-xl border px-3/);
  for(const label of ["概要","暴落翌日","市場比較","当日強弱","注意点"])assert.ok(tabs.includes(label));
  assert.match(tabs,/sticky top-0/);
  assert.match(tabs,/aria-selected/);
});

test("approved mockup: market cards show two rows each with top-right full expansion",()=>{
  assert.match(page,/<CrashBenchmarkCards/);
  assert.match(cards,/rows\.slice\(0,expanded\?20:2\)/);
  assert.match(cards,/もっと見る ›/);
  assert.match(cards,/setExpanded/);
  assert.match(cards,/市場に強い・上位20/);
  assert.match(cards,/市場に弱い・下位20/);
  assert.match(cards,/市場勝率/);
  assert.match(cards,/超過平均/);
  assert.ok(cards.includes('href={"/chart/"+item.code}'));
  assert.doesNotMatch(cards,/INSERT INTO|UPDATE public\.|DELETE FROM|sendLine|createOrder/);
});

test("approved mockup: four two-column shortcut tiles appear under the market comparison",()=>{
  assert.match(tabs,/active==="market" \|\| active==="overview"/);
  assert.match(tabs,/grid grid-cols-2 gap-2/);
  assert.equal((tabs.match(/title: ".*", subtitle:/g)||[]).length,4);
  assert.match(tabs,/過去の翌日上昇率/);
  assert.match(tabs,/研究上の注意点/);
  assert.match(tabs,/このコンテンツについて/);
});

test("all research is owner-guarded and uses the same read-only server analysis",()=>{
  assert.ok(page.indexOf("if (!isOwner) notFound()")<page.indexOf("await getReport()"));
  assert.equal((page.match(/await getReport\(\)/g)||[]).length,1);
  assert.match(page,/BottomNav/);
  assert.match(page,/5取引日後/);
  assert.doesNotMatch(page,/INSERT INTO|DELETE FROM|UPDATE public\.|sendLine|createOrder/);
});
