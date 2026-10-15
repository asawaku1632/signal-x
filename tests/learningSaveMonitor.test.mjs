import assert from "node:assert/strict";
import test from "node:test";
import { classifyLearningSave } from "../app/lib/learning/learningSaveMonitor.ts";

const nowMs = Date.parse("2026-10-15T12:00:00.000Z");
const runId = "test-save-daily-run";

function log(status, secondsAgo, details = {}) {
  return {
    status,
    createdAt: new Date(nowMs - secondsAgo * 1000).toISOString(),
    details: { runId, ...details },
  };
}

test("a saved stock snapshot followed by stalled enrichment is not reported as a DB failure", () => {
  const result = classifyLearningSave({
    savedCount: 953,
    logs: [
      log("SAVE_SUCCESS", 480, { stage: "SNAPSHOT_SAVED", savedCount: 953 }),
      log("STARTED", 600),
    ],
    nowMs,
  });
  assert.equal(result.classification, "POST_SAVE_FAILED");
});

test("a recently saved snapshot still inside the grace window remains running", () => {
  const result = classifyLearningSave({
    savedCount: 953,
    logs: [log("SAVE_SUCCESS", 100), log("STARTED", 150)],
    nowMs,
  });
  assert.equal(result.classification, "RUNNING");
});

test("a finished run with a saved snapshot is normal", () => {
  const result = classifyLearningSave({
    savedCount: 953,
    logs: [
      log("COMPLETED", 100),
      log("SAVE_SUCCESS", 170),
      log("STARTED", 250, { delaySeconds: 0 }),
    ],
    nowMs,
  });
  assert.equal(result.classification, "NORMAL");
});

test("a scan failure is still treated as a scan failure", () => {
  const result = classifyLearningSave({
    savedCount: 0,
    logs: [
      log("ERROR", 480, { stage: "scan" }),
      log("STARTED", 500),
    ],
    nowMs,
  });
  assert.equal(result.classification, "SCAN_FAILED");
});

test("an unsaved and stalled run is still treated as a stalled cron", () => {
  const result = classifyLearningSave({
    savedCount: 0,
    logs: [log("STARTED", 600)],
    nowMs,
  });
  assert.equal(result.classification, "CRON_STALLED");
});
