import test from "node:test";
import assert from "node:assert/strict";
import { classifyResearchCheckpoint, tokyoDateOnly } from "../app/lib/research/buyFailureCheckpointPolicy.mjs";

test("future checkpoint remains pending", () => {
  assert.equal(classifyResearchCheckpoint("PENDING_OR_MISSING", "2026-10-22", false), "NOT_YET_DUE");
});
test("due checkpoint with no observation is missing", () => {
  assert.equal(classifyResearchCheckpoint("PENDING_OR_MISSING", "2026-10-20", true), "MISSING");
});
test("unverified price is never marked verified or missing", () => {
  assert.equal(classifyResearchCheckpoint("UNVERIFIED", "2026-10-20", true), "UNVERIFIED");
});
test("calendar absence is not missing data", () => {
  assert.equal(classifyResearchCheckpoint("PENDING_OR_MISSING", null, false), "CALENDAR_UNAVAILABLE");
});
test("JST date handles UTC boundary", () => {
  assert.equal(tokyoDateOnly("2026-10-20T16:00:00Z"), "2026-10-21");
  assert.equal(tokyoDateOnly("2026-10-20T14:59:59Z"), "2026-10-20");
});
test("invalid timestamp rejected", () => {
  assert.throws(() => tokyoDateOnly("bad date"), /INVALID_TIMESTAMP/);
});
