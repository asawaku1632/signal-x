import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fingerprintPlayPurchaseToken as fingerprint } from "../app/lib/billing/playTokenFingerprint.ts";
const secret="sample-only-not-real-secret-1234567890abcdef";
test("same token produces same scoped fingerprint",()=>assert.equal(fingerprint("token-A",secret),fingerprint("token-A",secret)));
test("different tokens produce different fingerprints",()=>assert.notEqual(fingerprint("token-A",secret),fingerprint("token-B",secret)));
test("different secrets produce different fingerprints",()=>assert.notEqual(fingerprint("token-A",secret),fingerprint("token-A",secret+"x")));
test("fingerprint never equals raw token",()=>{const f=fingerprint("token-A",secret);assert.match(f,/^[0-9a-f]{64}$/);assert.ok(!f.includes("token-A"))});
test("missing secret and token fail closed",()=>{assert.throws(()=>fingerprint("",secret));assert.throws(()=>fingerprint("token-A","short"))});
test("proposed binding migration is additive, unique, private and server-only",async()=>{
 const sql=await readFile(new URL("../scripts/migrations/20261018_create_play_purchase_bindings_isolated.sql",import.meta.url),"utf8");
 assert.match(sql,/REFERENCES public\.signalx_users\(id\)/);
 assert.match(sql,/UNIQUE \(purchase_token_fingerprint\)/);
 assert.match(sql,/ENABLE ROW LEVEL SECURITY/);
 assert.match(sql,/FROM PUBLIC, anon, authenticated, service_role/);
 assert.doesNotMatch(sql,/^\s*(DROP|DELETE|TRUNCATE)\b/im);
});
