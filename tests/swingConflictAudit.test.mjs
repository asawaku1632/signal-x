import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { CONFLICT_HORIZONS, isRecentPrecursorAtExit } from "../app/lib/learning/swingConflictRules.ts";

const read = (path) => readFileSync(path, "utf8");

test("overlap uses five exchange sessions, skipping weekends and 2026-10-12 holiday", () => {
  assert.equal(isRecentPrecursorAtExit("2026-10-07", "2026-10-07"), true);
  assert.equal(isRecentPrecursorAtExit("2026-10-07", "2026-10-09"), true);
  assert.equal(isRecentPrecursorAtExit("2026-10-07", "2026-10-13"), true);
  assert.equal(isRecentPrecursorAtExit("2026-10-07", "2026-10-15"), true);
  assert.equal(isRecentPrecursorAtExit("2026-10-07", "2026-10-16"), false);
  assert.equal(isRecentPrecursorAtExit("2026-10-07", "2026-10-12"), false);
  assert.equal(isRecentPrecursorAtExit("2026-10-10", "2026-10-10"), false);
  assert.equal(isRecentPrecursorAtExit("2026-10-09", "2026-10-08"), false);
  assert.equal(isRecentPrecursorAtExit(null, "2026-10-09"), false);
  assert.equal(isRecentPrecursorAtExit("2028-01-05", "2028-01-05"), false);
});

test("overlap audit uses recorded forward signals without lookahead or writes", () => {
  const code = read("app/lib/learning/swingConflictAudit.ts");
  assert.match(code, /public\.swing_exit_audits/);
  assert.match(code, /public\.paper_trades/);
  assert.match(code, /public\.momentum_memory_observations/);
  assert.match(code, /m\.validation_mode = 'FORWARD'/);
  assert.match(code, /m\.observation_flag = TRUE/);
  assert.match(code, /m\.trade_date <= audit\.signal_date/);
  assert.match(code, /m\.created_at <= audit\.snapshot_at/);
  assert.match(code, /a\.user_email = \$1/);
  assert.doesNotMatch(code, /\b(?:INSERT|UPDATE|DELETE)\s+(?:INTO\s+|FROM\s+)?public\./);
});

test("horizons are 3, 5, 10 with missing prices never scored", () => {
  assert.deepEqual(CONFLICT_HORIZONS, [3, 5, 10]);
  const code = read("app/lib/learning/swingConflictAudit.ts");
  assert.match(code, /price == null \? null/);
  assert.match(code, /completed\.length \? reboundCount/);
  assert.match(code, /"EXIT_ONLY"/);
  assert.match(code, /"OVERLAP"/);
});

test("authentication, private cache, and navigation are in place", () => {
  const api = read("app/api/swing-conflict-audit/route.ts");
  const page = read("app/simulation/conflict-check/page.tsx");
  const navigation = read("app/simulation/page.tsx");
  assert.match(api, /getServerSession\(authOptions\)/);
  assert.match(api, /"private, no-store"/);
  assert.match(api, /getSwingConflictAuditReport\(email\)/);
  assert.doesNotMatch(api, /export async function POST/);
  assert.match(page, /比較データ収集中/);
  assert.match(page, /30件未満/);
  assert.match(navigation, /\/simulation\/conflict-check/);
});
