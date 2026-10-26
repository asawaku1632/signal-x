import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

// Research-only characterization tests. Do not modify production capture,
// stored decisions, notifications, or historical outcomes.
const read = (path) => readFileSync(path, "utf8");
const capture = read("app/lib/learning/swingUniverseAudit.ts");
const reportRoute = read("app/api/swing-universe-audit/route.ts");
const stocks = read("app/lib/stockList.ts");

test("the three 2026-10-26 alphanumeric codes are rejected by the existing numeric-only capture guard", () => {
  const numericOnly = /^[0-9]{4}$/;
  for (const code of ["590A", "641A", "642A"]) {
    assert.equal(numericOnly.test(code), false, code);
  }
  assert.match(capture, /!\/\^\[0-9\]\{4\}\$\/\.test\(row\.code\)/);
});

test("numeric-only capture and read API guards are explicit and remain unchanged", () => {
  assert.match(capture, /if \(!\/\^\[0-9\]\{4\}\$\/\.test\(row\.code\)/);
  assert.match(reportRoute, /if \(code && !\/\^\[0-9\]\{4\}\$\/\.test\(code\)\)/);
});

test("alphanumeric compatibility proposal preserves four-digit numeric codes", () => {
  const proposed = /^(?:[0-9]{4}|[0-9]{3}[A-Z])$/;
  for (const code of ["1301", "9984", "590A", "641A", "642A"]) {
    assert.equal(proposed.test(code), true, code);
  }
  for (const code of ["59A0", "A590", "590a", "12345", "12A", ""]) {
    assert.equal(proposed.test(code), false, code);
  }
});

test("590A is present in the source stock universe", () => {
  assert.match(stocks, /successorCode: "590A"/);
});
