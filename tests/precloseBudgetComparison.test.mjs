import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { comparePrecloseBudgets, fitsPrecloseBudget, PRECLOSE_RESEARCH_BUDGETS }
  from "../app/lib/research/precloseBudgetComparison.ts";

function row(code, price, aiPower = 95, changePct = 3, day = "2026-10-13", outcomeDate = "2026-10-14") {
  return {
    tradeDate: day, outcomeDate, code, name: "銘柄" + code,
    entryPrice: price, aiPower, sampledAt: day + "T06:15:00Z",
    outcomePrice: price * (1 + changePct / 100),
  };
}
const budgetLabels = [100_000, 300_000, 500_000, 1_000_000];

test("fixed four budgets model exactly 100 shares and include the upper boundary", () => {
  assert.deepEqual([...PRECLOSE_RESEARCH_BUDGETS], budgetLabels);
  assert.equal(fitsPrecloseBudget(row("1234", 1000), 100_000), true);
  assert.equal(fitsPrecloseBudget(row("1234", 1000.01), 100_000), false);
  assert.equal(fitsPrecloseBudget(row("1234", 3000), 300_000), true);
  assert.equal(fitsPrecloseBudget(row("1234", 5000), 500_000), true);
  assert.equal(fitsPrecloseBudget(row("1234", 10_000), 1_000_000), true);
  assert.equal(fitsPrecloseBudget(row("1234", -10), 1_000_000), false);
  assert.equal(fitsPrecloseBudget(row("1234", 1000), 0), false);
});

test("budget eligibility, positive-rate and 100-share drawdown cannot use today outcomes", () => {
  const history = [
    row("1001", 1000, 95, 3),    // 100k +3%
    row("1002", 3000, 95, -4),   // 300k -4%
    row("1003", 5000, 95, 1),    // 500k +1% HOLD
    row("1004", 10_000, 95, -10), // 1m -10%
    row("1005", 1000, 89, 50),   // excludes AI 89
    row("1006", 10_001, 95, 20), // above 1m excludes
    { ...row("1007", 1000, 95, 12), outcomePrice: null }, // unsettled
  ];
  const today = [
    row("2001", 999, 95, 100, "2026-10-15", "2026-10-16"),
    row("2002", 1100, 95, 4, "2026-10-15", "2026-10-16"),
    row("2003", 9500, 70, 4, "2026-10-15", "2026-10-16"),
  ];
  const res = comparePrecloseBudgets([...history, ...today], "2026-10-15");
  assert.deepEqual(res.map(x => x.reference.samples), [1, 2, 3, 4]);
  assert.deepEqual(res.map(x => x.researchCandidates.length), [1, 2, 2, 2]);
  assert.deepEqual(res.map(x => x.eligibleObservedToday), [1, 2, 2, 3]);
  assert.deepEqual(res.map(x => x.referenceProfitableCount), [1, 1, 2, 2]);
  assert.equal(res[1].reference.winRate, 50);
  assert.equal(res[1].reference.meanPnl100, (3000 - 12_000) / 2); // +3k, -12k
  assert.equal(res[3].worstPnl100, -100_000);
  assert.equal(res[2].reference.holds, 1);
});

test("new-day stock lacks outcome today; early dates are labelled reference, not a certification gate", () => {
  const sample = [
    row("1001", 900, 95, -5, "2026-10-14", "2026-10-15"),
    row("1002", 900, 95, 1000, "2026-10-15", "2026-10-16"),
    row("1003", 900, 95, 1000, "2026-10-14", "2026-10-16"),
  ];
  const res = comparePrecloseBudgets(sample, "2026-10-15");
  assert.equal(res[0].reference.samples, 1);
  assert.equal(res[0].reference.meanChangePct, -5);
  assert.equal(res[0].researchCandidates.length, 1);
  assert.equal("verifiedCandidates" in res[0], false);
});

test("private page uses only read-only observations and describes overlapping reference cohorts", () => {
  const page = readFileSync("app/admin/preclose-candidates/page.tsx", "utf8");
  const model = readFileSync("app/lib/research/precloseBudgetComparison.ts", "utf8");
  assert.match(page, /getLearningOwnerSession\(\)/);
  assert.match(page, /if \(!isOwner\) notFound\(\)/);
  assert.match(page, /購入予算別・15:15研究比較/);
  assert.match(page, /comparePrecloseBudgets\(observations, result\.date\)/);
  assert.match(page, /参考履歴も含み/);
  assert.match(page, /取引コスト・税金・スリッページは含みません/);
  assert.match(page, /実際の売買単位が100株と異なる/);
  assert.doesNotMatch(page + model,
    /\b(INSERT INTO|UPDATE public|DELETE FROM|runScan\(|pushWebToAll\(|sendNotification\(|saveDisplaySnapshot\()/i);
});
