import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const route = readFileSync(new URL("../app/api/admin/research/daily-forward-source/route.ts", import.meta.url),"utf8");

test("owner-only route rejects non-admin before any database access", () => {
  assert.match(route,/getAdminSession/);
  assert.match(route,/if \(!isAdmin\)/);
  assert.ok(route.indexOf("if (!isAdmin)") < route.indexOf("await pool.query("));
});
test("bounded parameterized read-only snapshot extraction", () => {
  assert.match(route,/requestedLimit > 200/);
  assert.match(route,/WHERE date >= \$1::date AND date <= \$2::date/);
  assert.match(route,/LIMIT \$3/);
  assert.doesNotMatch(route,/\b(INSERT|UPDATE|DELETE|UPSERT|TRUNCATE)\b/i);
  assert.match(route,/private, no-store/);
});
test("legacy source cannot be misrepresented as verified close", () => {
  assert.match(route,/priceBasisVerified: false/);
  assert.match(route,/UNVERIFIED_YAHOO_SCAN_SNAPSHOT/);
});
