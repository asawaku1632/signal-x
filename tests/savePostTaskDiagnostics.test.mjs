import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("../app/api/cron/save-post/route.ts", import.meta.url), "utf8");

test("pattern phase runs forward outcomes before TPR outcomes", () => {
  const pattern = source.indexOf('case "pattern":');
  const first = source.indexOf('label: "pattern-outcomes"', pattern);
  const last = source.indexOf('label: "trend-reversal-outcomes"', pattern);
  assert.ok(pattern >= 0 && first > pattern && last > first);
});

test("cron logs the current step before executing it and records failures", () => {
  const started = source.indexOf('message: "Post-save research task started"');
  const run = source.indexOf("await task.run();");
  const failed = source.indexOf('message: "Post-save research task failed"');
  assert.ok(started >= 0 && started < run && failed > run);
  assert.match(source, /stepState: "STARTED"/);
  assert.match(source, /stepState: "FAILED"/);
  assert.match(source, /throw taskError;/);
});
