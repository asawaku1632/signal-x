import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  calculateConfirmedWinRateDiff,
  calculateWinRate,
  getWinRateDisplay,
} from "../app/lib/winRateDisplay.ts";

function counts(overrides = {}) {
  return { total: 0, win: 0, lose: 0, hold: 0, unknown: 0, ...overrides };
}

test("勝率は WIN / (WIN + LOSE) を維持し、母数0はnullにする", () => {
  assert.equal(calculateWinRate(176, 118), 60);
  assert.equal(calculateWinRate(0, 10), 0);
  assert.equal(calculateWinRate(0, 0), null);
});

test("通常勝率と本当の0%を表示する", () => {
  assert.deepEqual(
    getWinRateDisplay(counts({ total: 960, win: 176, lose: 118, hold: 666 })),
    {
      state: "confirmed",
      winRate: 60,
      label: "60%",
      showBar: true,
      detail: "176勝 118敗",
    },
  );
  assert.equal(
    getWinRateDisplay(counts({ total: 10, lose: 10 })).label,
    "0%",
  );
});

test("判定待ち、HOLDのみ、データなしを0%と区別する", () => {
  assert.equal(
    getWinRateDisplay(counts({ total: 20, unknown: 20 })).label,
    "判定待ち",
  );
  assert.equal(
    getWinRateDisplay(counts({ total: 960, hold: 960 })).label,
    "方向性判定なし",
  );
  assert.equal(getWinRateDisplay(counts()).label, "--");
});

test("UNKNOWNが残る勝率だけを暫定表示する", () => {
  const provisional = getWinRateDisplay(
    counts({ total: 960, win: 3, hold: 17, unknown: 940 }),
  );
  assert.equal(provisional.label, "暫定 100%");
  assert.equal(provisional.detail, "3勝 0敗 / 未判定940件");
  assert.equal(provisional.showBar, true);

  assert.equal(
    getWinRateDisplay(counts({ total: 960, win: 20, hold: 940 })).label,
    "100%",
  );
});

test("前回比は母数ありかつUNKNOWNなしの確定日だけで計算する", () => {
  assert.equal(
    calculateConfirmedWinRateDiff([
      { win: 176, lose: 118, unknown: 0 },
      { win: 164, lose: 56, unknown: 0 },
      { win: 3, lose: 0, unknown: 940 },
      { win: 0, lose: 0, unknown: 20 },
    ]),
    15,
  );
  assert.equal(
    calculateConfirmedWinRateDiff([
      { win: 164, lose: 56, unknown: 0 },
      { win: 3, lose: 0, unknown: 940 },
    ]),
    null,
  );
});

test("両画面は共通表示関数を使い、差分はpt表記にする", () => {
  for (const file of ["app/learning/page.tsx", "app/result-stats/page.tsx"]) {
    assert.match(readFileSync(file, "utf8"), /getWinRateDisplay/);
  }
  const resultStats = readFileSync("app/result-stats/page.tsx", "utf8");
  assert.match(resultStats, /\$\{data\.diff\}pt/);
  assert.doesNotMatch(resultStats, /\{data\.diff\}%/);
});

test("save-daily-liteもAsia/Tokyo基準の日付を使う", () => {
  const source = readFileSync("app/api/learning/save-daily-lite/route.ts", "utf8");
  assert.match(source, /timeZone: "Asia\/Tokyo"/);
  assert.match(source, /const today = getJstDateString\(\)/);
  assert.doesNotMatch(source, /toISOString\(\)\.split\("T"\)/);
});
