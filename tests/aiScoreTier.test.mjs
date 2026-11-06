import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { getAiScoreTier, AI_SCORE_TIER_LEGEND } from "../app/lib/aiScoreTier.ts";

test("tier boundaries are stable, exclusive and descriptive", () => {
  const cases = [
    [100, "大本命"], [95, "大本命"], [94.9, "本命"], [90, "本命"],
    [89.9, "買い候補"], [85, "買い候補"], [84.9, "押し目待ち"],
    [75, "押し目待ち"], [74.9, "様子見"], [65, "様子見"],
    [64.9, "見送り"], [0, "見送り"],
  ];
  for (const [score, expected] of cases) {
    assert.equal(getAiScoreTier(score).label, expected, String(score));
  }
});

test("missing, invalid or out-of-range scores are not called a prime pick", () => {
  for (const score of [undefined, null, NaN, Infinity, -1, 101]) {
    assert.equal(getAiScoreTier(score).label, "未評価");
  }
  assert.match(AI_SCORE_TIER_LEGEND, /表示用のスコア区分/);
  assert.match(AI_SCORE_TIER_LEGEND, /実測勝率/);
});

test("shared badge is placed alongside names on key public stock surfaces", () => {
  const files = [
    "app/scan-mobile/page.tsx",
    "app/favorites/page.tsx",
    "app/top-signals/page.tsx",
    "app/scan/page.tsx",
    "app/ranking/page.tsx",
    "app/analysis/[code]/page.tsx",
    "app/page.tsx",
  ];
  for (const path of files) {
    const source = readFileSync(new URL("../" + path, import.meta.url), "utf8");
    assert.match(source, /import AiScoreTierBadge from "@\/app\/components\/stock\/AiScoreTierBadge";/, path);
    assert.match(source, /<AiScoreTierBadge score=\{/, path);
  }
  const badge = readFileSync(new URL("../app/components/stock/AiScoreTierBadge.tsx", import.meta.url), "utf8");
  assert.match(badge, /data-testid="ai-score-tier-badge"/);
  assert.match(badge, /売買推奨・実測勝率ではありません/);
});

test("stock tier remains presentation-only and never influences entries or push alerts", () => {
  const files = ["app/lib/aiScoreTier.ts", "app/components/stock/AiScoreTierBadge.tsx"];
  for (const path of files) {
    const src = readFileSync(new URL("../" + path, import.meta.url), "utf8");
    assert.doesNotMatch(src, /\bfetch\(|\bupdate\(|\bpool\.query\(|\brefreshScanSnapshot\(/);
  }
});
