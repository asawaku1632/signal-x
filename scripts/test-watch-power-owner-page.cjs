const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const page = fs.readFileSync(path.join(__dirname, "../app/admin/watch-power-holdout/page.tsx"), "utf8");

test("owner authorization precedes the first database read", () => {
  const owner = page.indexOf("await getLearningOwnerSession()");
  const deny = page.indexOf("if (!isOwner) notFound()");
  const query = page.indexOf("await pool.query");
  assert.ok(owner >= 0 && deny > owner && query > deny);
});

test("report uses a bounded parameterized read-only SELECT", () => {
  assert.match(page, /SELECT code, trade_date::text AS trade_date/);
  assert.match(page, /WHERE trade_date > \\$1::date AND decision_status = \\$2/);
  assert.match(page, /LIMIT 20001/);
  assert.match(page, /result\.rows\.length > 20000/);
  assert.match(page, /if \(!truncated\)/);
  assert.doesNotMatch(page, /\b(?:INSERT|UPDATE|DELETE|UPSERT|TRUNCATE|DROP|ALTER)\b/i);
});

test("report fails closed on database errors and is not cached", () => {
  assert.match(page, /if \(!isOwner\) notFound\(\)/);
  assert.match(page, /catch \(cause\)/);
  assert.match(page, /error = true/);
  assert.match(page, /export const dynamic = "force-dynamic"/);
  assert.match(page, /export const revalidate = 0/);
  assert.match(page, /report\.reviewReady && report\.dateEqualWeightDifferencePp !== null/);
});
