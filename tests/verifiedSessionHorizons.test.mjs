import test from "node:test";
import assert from "node:assert/strict";
import { alignVerifiedSessionHorizons as align } from "../app/lib/research/verifiedSessionHorizons.mjs";

const sessions = ["2026-09-18", "2026-09-24", "2026-09-25",
  "2026-09-28", "2026-09-29", "2026-09-30"];
const prices = new Map(sessions.map((d, i) => [d, 100 + i * 2]));
const topix = new Map(sessions.map((d, i) => [d, 2000 + i * 10]));
const fixture = () => ({
  signalDate: "2026-09-18", asOfDate: "2026-10-01",
  exchangeSessions: sessions, calendarVerified: true, calendarComplete: true,
  stockCloses: prices, indexCloses: topix,
});

test("fail closed on unverified or incomplete calendar", () => {
  assert.equal(align({ ...fixture(), calendarVerified: false }).status, "BLOCKED");
  assert.equal(align({ ...fixture(), calendarComplete: false }).status, "BLOCKED");
});

test("aligns stock and TOPIX to identical fifth actual exchange session", () => {
  const result = align(fixture());
  assert.equal(result.status, "RESEARCH_ONLY");
  assert.equal(result.horizons[1].date, "2026-09-24");
  assert.equal(result.horizons[3].date, "2026-09-28");
  assert.equal(result.horizons[5].date, "2026-09-30");
  assert.ok(Math.abs(result.horizons[5].stockReturn - 10) < 1e-9);
  assert.ok(Math.abs(result.horizons[5].benchmarkReturn - 2.5) < 1e-9);
  assert.ok(Math.abs(result.horizons[5].excessReturn - 7.5) < 1e-9);
});

test("holiday stock snapshots do not shift horizons", () => {
  const stock = new Map([...prices, ["2026-09-21", 999], ["2026-09-22", 999]]);
  const result = align({ ...fixture(), stockCloses: stock });
  assert.equal(result.horizons[1].date, "2026-09-24");
  assert.ok(Math.abs(result.horizons[5].stockReturn - 10) < 1e-9);
});

test("missing exact fifth-session TOPIX does not substitute a later close", () => {
  const index = new Map(topix);
  index.delete("2026-09-30");
  assert.equal(align({ ...fixture(), indexCloses: index }).horizons[5].status, "MISSING_CLOSE");
});

test("missing calendar session, duplicate and unordered dates are rejected when not verified", () => {
  assert.equal(align({ ...fixture(), calendarComplete: false, exchangeSessions: sessions.slice(1) }).status, "BLOCKED");
  assert.equal(align({ ...fixture(), exchangeSessions: [sessions[0], sessions[0], ...sessions.slice(1)] }).status, "BLOCKED");
  assert.equal(align({ ...fixture(), exchangeSessions: [...sessions].reverse() }).status, "BLOCKED");
});

test("future sessions are pending, not forward-looking outcomes", () => {
  const result = align({ ...fixture(), asOfDate: "2026-09-29" });
  assert.equal(result.horizons[5].status, "PENDING");
});

test("missing base prices and invalid index values block or withhold results", () => {
  assert.equal(align({ ...fixture(), stockCloses: new Map() }).status, "BLOCKED");
  const index = new Map(topix);
  index.set("2026-09-30", 0);
  assert.equal(align({ ...fixture(), indexCloses: index }).horizons[5].status, "MISSING_CLOSE");
});
