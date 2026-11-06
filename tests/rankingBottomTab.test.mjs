import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const nav = readFileSync(new URL("../app/components/BottomNav.tsx", import.meta.url), "utf8");
const menu = readFileSync(new URL("../app/menu/page.tsx", import.meta.url), "utf8");
const ranking = readFileSync(new URL("../app/ranking/page.tsx", import.meta.url), "utf8");

test("bottom AI分析 tab is replaced by a ranking tab without changing six public destinations", () => {
  const publicBlock = nav.slice(nav.indexOf("const publicNavItems:"), nav.indexOf("const privateLearningNav:"));
  assert.equal((publicBlock.match(/    href: "/g) ?? []).length, 6);
  assert.match(publicBlock, /href: "\/ranking",\s*icon: "🏅",\s*label: "ランキング"/);
  assert.doesNotMatch(publicBlock, /href: "\/ai-analysis"/);
  assert.match(publicBlock, /href: "\/scan-mobile"/);
  assert.match(publicBlock, /label: "注目株"/);
  assert.match(publicBlock, /matchPaths: \["\/ranking", "\/analysis"\]/);
});

test("legacy AI-analysis page remains available from the Menu rather than being removed", () => {
  assert.match(menu, /title: "AI分析", description: "従来のAI分析ページを開く", href: "\/ai-analysis"/);
  const analysis = readFileSync(new URL("../app/ai-analysis/page.tsx", import.meta.url), "utf8");
  assert.match(analysis, /export default function AiAnalysisPage\(/);
});

test("ranking tab opens the existing compact TOP100 page and preserves all owner navigation", () => {
  assert.match(ranking, /data-testid="compact-ranking-card"/);
  assert.match(ranking, /AIランキング/);
  assert.match(nav, /const privateLearningNav:/);
  assert.match(nav, /publicNavItems\.slice\(0, 5\), privateLearningNav, \.\.\.publicNavItems\.slice\(5\)/);
  assert.match(nav, /pathname === path \|\| pathname\.startsWith/);
});
