import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const route = fs.readFileSync("app/api/cron/favorite-ai-check/route.ts", "utf8");

test("result push does not discard monitor context by linking straight to analysis", () => {
  const resultPushBlock = route.slice(route.indexOf("const result = monitor.status"), route.indexOf("const lineUserId", route.indexOf("const result = monitor.status")));
  assert.doesNotMatch(resultPushBlock, /url:\s*`\/analysis\//);
  assert.match(resultPushBlock, /url:\s*resultAlertUrl\(monitor\)/);
});
