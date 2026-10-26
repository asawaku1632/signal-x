import test from "node:test";
import assert from "node:assert/strict";
import { withLicensedQuoteNotification } from "../app/lib/favoriteQuoteLicenseGuard.ts";

test("unlicensed Yahoo source never invokes LINE or Web Push callback", async () => {
  let sends = 0;
  const dispatch = async () => { sends += 1; return { ok: true }; };
  for (const source of ["intraday", "daily_fallback", "YAHOO_FINANCE_QUOTE", undefined, "licensed"]) {
    const result = await withLicensedQuoteNotification(source, dispatch);
    assert.equal(result.dispatched, false);
    assert.equal(result.reason, "licensed_quote_provider_not_configured");
  }
  assert.equal(sends, 0);
});

test("a rejected source does not touch database write callback", async () => {
  let writes = 0;
  const result = await withLicensedQuoteNotification(null, async () => { writes++; });
  assert.equal(result.dispatched, false);
  assert.equal(writes, 0);
});
