import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(
  new URL("../../api/admin/market-index-research/dashboard/route.ts", import.meta.url),
  "utf8",
);

test("dashboard route checks admin before returning research data", () => {
  assert.match(source, /getAdminSession\(\)/);
  assert.match(source, /if \(!isAdmin\)/);
  assert.match(source, /status: 403/);
});

test("dashboard route is GET-only, read-only and explicitly disconnected", () => {
  assert.match(source, /export async function GET\(\)/);
  assert.doesNotMatch(source, /export async function POST\(/);
  assert.match(source, /buildResearchDashboardModel\(\[\]\)/);
  assert.match(source, /NO_CONNECTED_EVIDENCE/);
  assert.match(source, /hasLiveEvidence: false/);
  assert.match(source, /Cache-Control.*no-store/);
  assert.doesNotMatch(source, /DATABASE_URL|createClient|fetch\(/);
});
