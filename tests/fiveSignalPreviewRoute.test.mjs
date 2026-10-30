import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../app/api/push/five-signal-preview/route.ts", import.meta.url), "utf8");

test("five-signal evidence endpoint requires owner session", () => {
  assert.match(source, /getLearningOwnerSession\(\)/);
  assert.match(source, /if \(!owner\.isOwner\)/);
  assert.match(source, /status: 404/);
});

test("read-only endpoint never sends notifications or updates data", () => {
  assert.doesNotMatch(source, /pushWebToUser|sendWebPush|pushWebToAll|pool\.query|INSERT INTO|UPDATE public\./);
  assert.match(source, /deliveryEnabled: false/);
  assert.match(source, /automaticRelease: false/);
  assert.match(source, /candidateCount: null/);
});

test("historical surge research is not presented as five verified live signals", () => {
  assert.match(source, /RELATED_HISTORICAL_AGGREGATE_ONLY/);
  assert.match(source, /NOT_YET_MAPPED/);
  assert.match(source, /signal\.key === "profit_precursor"/);
});
