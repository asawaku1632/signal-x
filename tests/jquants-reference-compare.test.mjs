import test from "node:test";
import assert from "node:assert/strict";
import { compareHistoricalBar } from "../app/lib/research/jquants-reference-compare.ts";
const bar = { Code: "39960", Date: "2026-07-01", O: 173, H: 175, L: 173, C: 175, Vo: 7000 };
test("match", () => assert.equal(compareHistoricalBar(bar), "REFERENCE_MATCH"));
test("close differs", () => assert.equal(compareHistoricalBar({ ...bar, C: 176 }), "REFERENCE_MISMATCH"));
test("volume differs", () => assert.equal(compareHistoricalBar({ ...bar, Vo: 7001 }), "REFERENCE_MISMATCH"));
test("missing value", () => assert.equal(compareHistoricalBar({ ...bar, H: null }), "FIELDS_MISSING"));
test("wrong date", () => assert.equal(compareHistoricalBar({ ...bar, Date: "2026-07-02" }), "WRONG_BAR"));
test("wrong code", () => assert.equal(compareHistoricalBar({ ...bar, Code: "39970" }), "WRONG_BAR"));
test("non-finite value", () => assert.equal(compareHistoricalBar({ ...bar, O: Number.NaN }), "FIELDS_MISSING"));
test("numeric string is rejected", () => assert.equal(compareHistoricalBar({ ...bar, C: "175" }), "FIELDS_MISSING"));
test("missing bar", () => assert.equal(compareHistoricalBar(null), "WRONG_BAR"));
test("wrong shape", () => assert.equal(compareHistoricalBar([]), "WRONG_BAR"));
test("wrong open", () => assert.equal(compareHistoricalBar({ ...bar, O: 174 }), "REFERENCE_MISMATCH"));
test("wrong high", () => assert.equal(compareHistoricalBar({ ...bar, H: 176 }), "REFERENCE_MISMATCH"));
test("wrong low", () => assert.equal(compareHistoricalBar({ ...bar, L: 174 }), "REFERENCE_MISMATCH"));

test("all five numeric fields must be finite", () => {
  for (const field of ["O", "H", "L", "C", "Vo"]) {
    for (const value of [Number.NaN, Infinity, -Infinity, null, undefined, "175"]) {
      assert.equal(compareHistoricalBar({ ...bar, [field]: value }), "FIELDS_MISSING", `${field}: ${String(value)}`);
    }
  }
});
test("every fixed reference field is compared independently", () => {
  for (const field of ["O", "H", "L", "C", "Vo"]) {
    assert.equal(compareHistoricalBar({ ...bar, [field]: bar[field] + 1 }), "REFERENCE_MISMATCH", field);
  }
});
test("ambiguous identity values are never accepted", () => {
  for (const invalid of [{ ...bar, Code: 39960 }, { ...bar, Date: 20260701 }, { ...bar, Code: "3996" }, { ...bar, Date: "2026/07/01" }]) {
    assert.equal(compareHistoricalBar(invalid), "WRONG_BAR");
  }
});
test("comparison does not mutate provider objects", () => {
  const frozen = Object.freeze({ ...bar });
  assert.equal(compareHistoricalBar(frozen), "REFERENCE_MATCH");
  assert.deepEqual(frozen, bar);
});
