import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const loader = readFileSync(new URL("../app/lib/push/fiveSignalForwardResearch.ts", import.meta.url), "utf8");
const route = readFileSync(new URL("../app/api/push/five-signal-preview/route.ts", import.meta.url), "utf8");

test("historical observations include four independent research sources", () => {
  for (const key of ["MM_V1", "HAP_V1", "AIR_V1", "TPR_V1"]) {
    assert.ok(loader.includes(key), key);
  }
});

test("historical observations are read only and FORWARD only", () => {
  assert.match(loader, /validation_mode = 'FORWARD'/);
  assert.match(loader, /observation_flag = true/);
  assert.match(loader, /LIMIT \$1/);
  assert.doesNotMatch(loader, /INSERT INTO|UPDATE public\.|DELETE FROM|pushWebToUser/);
});

test("research API is owner only and does not activate push", () => {
  assert.match(route, /getLearningOwnerSession/);
  assert.match(route, /if \(!owner\.isOwner\)/);
  assert.match(route, /HISTORICAL_ONLY/);
  assert.match(route, /automaticRelease: false/);
  assert.match(route, /notificationsSent: 0/);
});

test("missing historical tables are not mistaken for empty research", () => {
  assert.match(loader, /to_regclass/);
  assert.match(loader, /FORWARD_RESEARCH_TABLES_MISSING/);
  assert.match(route, /SOURCE_UNAVAILABLE/);
});
