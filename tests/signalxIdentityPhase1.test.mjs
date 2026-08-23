import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { createSignalxUserResolver } from "../app/lib/signalxIdentityCore.ts";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

class FakeIdentityDatabase {
  users = new Map();
  identities = new Map();
  nextId = 1;
  forceUniqueWinner = null;
  failUserInsert = false;

  key(provider, subject) {
    return `${provider}\u0000${subject}`;
  }

  async query(sql, values = []) {
    return this.execute(this, sql, values);
  }

  async connect() {
    const transaction = {
      pendingUsers: new Map(),
      pendingIdentities: new Map(),
      active: false,
    };
    return {
      query: (sql, values = []) => this.execute(transaction, sql, values),
      release() {},
    };
  }

  async execute(target, sql, values) {
    const normalized = sql.replace(/\s+/g, " ").trim();
    if (normalized === "BEGIN") {
      target.active = true;
      return { rows: [] };
    }
    if (normalized === "ROLLBACK") {
      target.pendingUsers.clear();
      target.pendingIdentities.clear();
      target.active = false;
      return { rows: [] };
    }
    if (normalized === "COMMIT") {
      for (const [id, row] of target.pendingUsers) this.users.set(id, row);
      for (const [key, row] of target.pendingIdentities) this.identities.set(key, row);
      target.active = false;
      return { rows: [] };
    }
    if (normalized.startsWith("SELECT user_id FROM public.signalx_identities")) {
      const row = target.pendingIdentities?.get(this.key(values[0], values[1]))
        ?? this.identities.get(this.key(values[0], values[1]));
      return { rows: row ? [{ user_id: row.userId }] : [] };
    }
    if (normalized.startsWith("UPDATE public.signalx_identities")) {
      const key = this.key(values[0], values[1]);
      const row = target.pendingIdentities?.get(key) ?? this.identities.get(key);
      if (!row) return { rows: [] };
      row.email = values[2];
      row.loginCount = (row.loginCount ?? 0) + 1;
      return { rows: [{ user_id: row.userId }] };
    }
    if (normalized.startsWith("INSERT INTO public.signalx_users")) {
      if (this.failUserInsert) throw new Error("simulated user insert failure");
      const id = `00000000-0000-4000-8000-${String(this.nextId++).padStart(12, "0")}`;
      target.pendingUsers.set(id, { email: values[0], verified: values[1] });
      return { rows: [{ id }] };
    }
    if (normalized.startsWith("INSERT INTO public.signalx_identities")) {
      const key = this.key(values[1], values[2]);
      if (this.forceUniqueWinner) {
        const winnerId = this.forceUniqueWinner;
        this.users.set(winnerId, { email: values[3], verified: true });
        this.identities.set(key, { userId: winnerId, email: values[3] });
        this.forceUniqueWinner = null;
        throw Object.assign(new Error("duplicate identity"), { code: "23505" });
      }
      if (this.identities.has(key)) {
        throw Object.assign(new Error("duplicate identity"), { code: "23505" });
      }
      target.pendingIdentities.set(key, { userId: values[0], email: values[3] });
      return { rows: [] };
    }
    throw new Error(`Unexpected fake query: ${normalized}`);
  }
}

const google = (subject, email = "person@example.com") => ({
  provider: "google",
  providerSubject: subject,
  email,
  emailVerified: true,
});

test("new Google user creates one user and one identity", async () => {
  const db = new FakeIdentityDatabase();
  const id = await createSignalxUserResolver(db)(google("google-sub-1"));
  assert.match(id, /^[0-9a-f-]{36}$/);
  assert.equal(db.users.size, 1);
  assert.equal(db.identities.size, 1);
});

test("existing identity and repeated login preserve signalx_user_id", async () => {
  const db = new FakeIdentityDatabase();
  const resolve = createSignalxUserResolver(db);
  const first = await resolve(google("stable-sub"));
  const second = await resolve(google("stable-sub"));
  assert.equal(second, first);
  assert.equal(db.users.size, 1);
});

test("email change and email casing do not affect identity resolution", async () => {
  const db = new FakeIdentityDatabase();
  const resolve = createSignalxUserResolver(db);
  const first = await resolve(google("same-sub", "First@Example.COM"));
  const second = await resolve(google("same-sub", "renamed@example.com"));
  assert.equal(second, first);
  assert.equal(db.identities.get(db.key("google", "same-sub")).email, "renamed@example.com");
  assert.equal([...db.users.values()][0].email, "first@example.com");
});

test("UNIQUE race rolls back losing user and returns winning identity", async () => {
  const db = new FakeIdentityDatabase();
  const winner = "00000000-0000-4000-8000-999999999999";
  db.forceUniqueWinner = winner;
  const resolved = await createSignalxUserResolver(db)(google("racing-sub"));
  assert.equal(resolved, winner);
  assert.deepEqual([...db.users.keys()], [winner]);
  assert.equal(db.identities.size, 1);
});

test("transaction failure rolls back and leaves no orphan user", async () => {
  const db = new FakeIdentityDatabase();
  db.failUserInsert = true;
  await assert.rejects(
    createSignalxUserResolver(db)(google("failed-sub")),
    /simulated user insert failure/,
  );
  assert.equal(db.users.size, 0);
  assert.equal(db.identities.size, 0);
});

test("invalid or empty provider subject fails closed", async () => {
  const db = new FakeIdentityDatabase();
  const resolve = createSignalxUserResolver(db);
  await assert.rejects(resolve(google("   ")), /Invalid verified provider subject/);
  await assert.rejects(resolve(google("x".repeat(256))), /Invalid verified provider subject/);
});

test("migration is additive, constrained, indexed, and server-only", async () => {
  const sql = await read("scripts/migrations/20260823_create_signalx_user_identity.sql");
  assert.match(sql, /CREATE TABLE public\.signalx_users/);
  assert.match(sql, /CREATE TABLE public\.signalx_identities/);
  assert.match(sql, /UNIQUE \(provider, provider_subject\)/);
  assert.match(sql, /REFERENCES public\.signalx_users \(id\)\s+ON DELETE CASCADE/);
  assert.match(sql, /CREATE INDEX signalx_identities_user_id_idx/);
  assert.match(sql, /ENABLE ROW LEVEL SECURITY/g);
  assert.match(sql, /FROM PUBLIC, anon, authenticated, service_role/g);
  assert.doesNotMatch(sql, /^\s*(DROP|DELETE|UPDATE|ALTER\s+COLUMN)\b/im);
});

test("Google OAuth callback uses providerAccountId and exposes only user id", async () => {
  const auth = await read("app/lib/auth.ts");
  const types = await read("types/next-auth.d.ts");
  assert.match(auth, /account\?\.provider === "google"/);
  assert.match(auth, /providerSubject: account\.providerAccountId/);
  assert.match(auth, /token\.signalxUserId = await resolveSignalxUser/);
  assert.match(auth, /session\.user\.id = token\.signalxUserId/);
  assert.doesNotMatch(auth, /token\.(premium|plan|subscription)/i);
  assert.match(types, /signalxUserId\?: string/);
});

test("Credentials review account remains separated from Google identity", async () => {
  const auth = await read("app/lib/auth.ts");
  assert.match(auth, /account\?\.provider === PLAY_REVIEW_PROVIDER_ID/);
  assert.match(auth, /delete token\.signalxUserId/);
  assert.doesNotMatch(auth, /provider:\s*"google"[\s\S]{0,200}PLAY_REVIEW_PROVIDER_ID/);
});

test("favorites and Push continue to use normalized session email", async () => {
  const favorites = await read("app/api/favorites/route.ts");
  const pushSubscriptions = await read("app/api/push/subscriptions/route.ts");
  const pushTest = await read("app/api/push/test/route.ts");
  assert.match(favorites, /session\?\.user\?\.email\?\.trim\(\)\.toLowerCase\(\)/);
  assert.match(pushSubscriptions, /normalizePushUserEmail\(email\)/);
  assert.match(pushTest, /normalizePushUserEmail\(email\)/);
  for (const source of [favorites, pushSubscriptions, pushTest]) {
    assert.doesNotMatch(source, /signalxUserId|session\?\.user\?\.id/);
  }
});

test("resolver is server-only and does not log subjects or OAuth tokens", async () => {
  const resolver = await read("app/lib/signalxIdentity.ts");
  const core = await read("app/lib/signalxIdentityCore.ts");
  assert.match(resolver, /^import "server-only";/);
  assert.doesNotMatch(`${resolver}\n${core}`, /console\.|access_token|id_token|refresh_token/);
});
