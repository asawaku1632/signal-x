import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { classifyLearningSave } from "../app/lib/learning/learningSaveMonitor.ts";

const read = (file) => readFileSync(file, "utf8");

function log(status, runId, createdAt, details = {}) {
  return { status, createdAt, details: { runId, ...details } };
}

test("save-daily excludes BB processing and completes after related learning", () => {
  const source = read("app/api/learning/save-daily/route.ts");
  assert.doesNotMatch(source, /runBbObservation|bbObservation/);
  const relatedCompleted = source.indexOf('stage = "RELATED_LEARNING_COMPLETED"');
  const beforeCompleted = source.indexOf('stage = "BEFORE_COMPLETED"');
  const completed = source.indexOf('stage = "COMPLETED"');
  assert.ok(relatedCompleted > 0);
  assert.ok(beforeCompleted > relatedCompleted);
  assert.ok(completed > beforeCompleted);
});

test("save-daily records every required stage", () => {
  const source = read("app/api/learning/save-daily/route.ts");
  for (const stage of [
    "DAILY_SAVE_STARTED",
    "SNAPSHOT_SAVED",
    "RELATED_LEARNING_STARTED",
    "RELATED_LEARNING_COMPLETED",
    "BEFORE_COMPLETED",
    "COMPLETED",
  ]) {
    assert.match(source, new RegExp(`stage = "${stage}"`));
  }
});

test("a related-learning failure is caught before the finally lock release", () => {
  const source = read("app/api/learning/save-daily/route.ts");
  const relatedCall = source.indexOf("await saveRelatedLearning(targetDate, stocks)");
  const errorLog = source.indexOf('status: "ERROR"', relatedCall);
  const finallyBlock = source.indexOf("} finally {", errorLog);
  const release = source.indexOf("await releaseDailySaveLock(targetDate, runId)", finallyBlock);
  assert.ok(relatedCall > 0);
  assert.ok(errorLog > relatedCall);
  assert.ok(finallyBlock > errorLog);
  assert.ok(release > finallyBlock);
});

test("the lock lease expires and can be atomically replaced", () => {
  const source = read("app/lib/learning/dailySaveLock.ts");
  assert.match(source, /DAILY_SAVE_LOCK_LEASE_SECONDS = 4 \* 60/);
  assert.match(source, /cron_execution_locks\.expires_at <= NOW\(\)/);
  assert.match(source, /ON CONFLICT \(lock_key\) DO UPDATE/);
});

test("ALREADY_RUNNING does not replace the actual execution start", () => {
  const now = Date.parse("2026-08-14T07:30:00.000Z");
  const result = classifyLearningSave({
    savedCount: 959,
    nowMs: now,
    logs: [
      log("SKIPPED", "duplicate", "2026-08-14T06:50:32.950Z", { reason: "ALREADY_RUNNING" }),
      log("RECEIVED", "duplicate", "2026-08-14T06:50:32.645Z", { delaySeconds: 931 }),
      log("SAVE_SUCCESS", "actual", "2026-08-14T06:48:31.188Z"),
      log("STARTED", "actual", "2026-08-14T06:48:12.067Z", { delaySeconds: 790 }),
      log("RECEIVED", "actual", "2026-08-14T06:48:11.720Z", { delaySeconds: 790 }),
    ],
  });
  assert.equal(result.received.details.runId, "actual");
  assert.equal(result.delaySeconds, 790);
  assert.equal(result.classification, "CRON_STALLED");
});

test("completion and errors are followed within the selected runId", () => {
  const now = Date.parse("2026-08-14T06:50:00.000Z");
  const completed = classifyLearningSave({
    savedCount: 959,
    nowMs: now,
    logs: [
      log("COMPLETED", "actual", "2026-08-14T06:49:00.000Z"),
      log("STARTED", "actual", "2026-08-14T06:48:00.000Z", { delaySeconds: 780 }),
    ],
  });
  assert.equal(completed.classification, "NORMAL");

  const failed = classifyLearningSave({
    savedCount: 959,
    nowMs: now,
    logs: [
      log("ERROR", "actual", "2026-08-14T06:49:00.000Z", { stage: "related-learning-save" }),
      log("STARTED", "actual", "2026-08-14T06:48:00.000Z", { delaySeconds: 780 }),
    ],
  });
  assert.equal(failed.classification, "POST_SAVE_FAILED");
});
