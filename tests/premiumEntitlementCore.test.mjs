import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { hasPremiumAccess } from "../app/lib/billing/premiumEntitlementCore.ts";

const NOW = new Date("2026-10-18T00:00:00Z");
const valid = { userId: "user-a", provider: "stripe", externalSubscriptionId: "sub_1", status: "active", validUntil: "2026-11-18T00:00:00Z" };
test("active account with future expiry is premium", () => assert.equal(hasPremiumAccess("user-a", [valid], NOW), true));
test("other users cannot inherit access", () => assert.equal(hasPremiumAccess("user-b", [valid], NOW), false));
test("empty identifiers fail closed", () => assert.equal(hasPremiumAccess("", [valid], NOW), false));
test("invalid expiration fails closed", () => assert.equal(hasPremiumAccess("user-a", [{...valid, validUntil: "bad"}], NOW), false));
test("missing expiration fails closed", () => assert.equal(hasPremiumAccess("user-a", [{...valid, validUntil: null}], NOW), false));
test("expiry at current instant denies access", () => assert.equal(hasPremiumAccess("user-a", [{...valid, validUntil: NOW}], NOW), false));
test("revocation overrides active status", () => assert.equal(hasPremiumAccess("user-a", [{...valid, revokedAt: NOW}], NOW), false));
test("trial and grace are granted only before expiry", () => {
  for (const status of ["trialing", "grace_period"]) assert.equal(hasPremiumAccess("user-a", [{...valid, status}], NOW), true);
});
test("past due, canceled, paused, expired and revoked deny access", () => {
  for (const status of ["past_due", "canceled", "paused", "expired", "revoked"]) assert.equal(hasPremiumAccess("user-a", [{...valid, status}], NOW), false);
});
test("Google Play and Stripe use same user ID policy", () => assert.equal(hasPremiumAccess("user-a", [{...valid, provider: "google_play"}], NOW), true));
test("isolated migration has no destructive mutations", async () => {
  const sql = await readFile(new URL("../scripts/migrations/20261018_create_premium_entitlements_isolated.sql", import.meta.url), "utf8");
  assert.match(sql, /REFERENCES public\.signalx_users\(id\)/);
  assert.match(sql, /ENABLE ROW LEVEL SECURITY/);
  assert.match(sql, /UNIQUE \(provider, external_subscription_id\)/);
  assert.doesNotMatch(sql, /^\s*(DROP|DELETE|TRUNCATE)\b/im);
});
