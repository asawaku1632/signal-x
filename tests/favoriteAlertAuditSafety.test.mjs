import test from "node:test";
import assert from "node:assert/strict";
import { persistFavoriteAuditOrCancel } from "../app/lib/favoriteAlertAuditSafety.ts";

test("successful audit keeps monitor and permits downstream notification", async () => {
  const calls = [];
  const result = await persistFavoriteAuditOrCancel("monitor-1",
    async () => { calls.push("audit"); },
    async () => { calls.push("cancel"); });
  assert.equal(result, "recorded");
  assert.deepEqual(calls, ["audit"]);
});

test("failed audit cancels monitor and blocks downstream notification", async () => {
  const calls = [];
  let notified = false;
  const result = await persistFavoriteAuditOrCancel("monitor-2",
    async () => { calls.push("audit"); throw new Error("audit unavailable"); },
    async (id) => { calls.push("cancel:" + id); });
  if (result === "recorded") notified = true;
  assert.equal(result, "cancelled");
  assert.equal(notified, false);
  assert.deepEqual(calls, ["audit", "cancel:monitor-2"]);
});

test("failed cancellation stops processing with both errors", async () => {
  await assert.rejects(
    persistFavoriteAuditOrCancel("monitor-3",
      async () => { throw new Error("audit failed"); },
      async () => { throw new Error("cancel failed"); }),
    (error) => error instanceof AggregateError && error.errors.length === 2,
  );
});
