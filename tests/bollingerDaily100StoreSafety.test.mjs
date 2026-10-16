import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import ts from "typescript";

const source = readFileSync("app/lib/research/bollingerDaily100Store.ts", "utf8");
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const REF = "jdtqwryiyxeuoraecorw";
function harness({ identity = REF, failInsert = false, block = false } = {}) {
  const calls = [];
  let connections = 0, releases = 0;
  const client = {
    async query(sql) {
      calls.push(sql);
      if (["BEGIN", "COMMIT", "ROLLBACK"].includes(sql)) return { rows: [] };
      if (sql.includes("database_project_ref")) return { rows: [{ database_project_ref: identity }] };
      if (sql.includes("INSERT")) {
        if (failInsert) throw Error("INSERT_FAILED");
        return { rowCount: 1, rows: [{ partition_id: 0 }] };
      }
      return { rows: [] };
    },
    release() { releases++; },
  };
  const pool = { async connect() { connections++; return client; } };
  const exports = {};
  const requireFn = name => {
    if (name === "@/app/lib/postgres") return { default: pool };
    if (name === "./bollingerDaily100DbGuard") return {
      assertDaily100DevDatabase: () => { if (block) throw Error("BLOCKED"); },
      DAILY100_DEV_PROJECT_REF: REF,
    };
    if (name === "./bollingerDaily100Claim") return { claimDaily100Partition: async () => ({ state: "DISABLED" }) };
    if (name === "./bollingerForwardUniverse") return { BB_FORWARD_FROZEN_CODES: [] };
    return {};
  };
  new Function("require", "exports", js)(requireFn, exports);
  return { api: exports, calls, get connections() { return connections; }, get releases() { return releases; } };
}
const args = { tradeDate: "2026-10-16", partitionId: 0, policyVersion: "V1", codes: ["3000"] };

test("identity check and INSERT use one client and COMMIT", async () => {
  const h = harness();
  assert.equal(await h.api.tryInsertDaily100Claim(args), true);
  assert.equal(h.connections, 1);
  assert.equal(h.releases, 1);
  assert.deepEqual(h.calls.map(s => ["BEGIN", "COMMIT", "ROLLBACK"].includes(s) ? s : s.includes("database_project_ref") ? "IDENTITY" : "INSERT"), ["BEGIN", "IDENTITY", "INSERT", "COMMIT"]);
});
test("wrong database identity prevents INSERT and rolls back", async () => {
  const h = harness({ identity: "wrong" });
  await assert.rejects(h.api.tryInsertDaily100Claim(args), /IDENTITY_MISMATCH/);
  assert.equal(h.calls.some(s => s.includes("INSERT")), false);
  assert.equal(h.calls.at(-1), "ROLLBACK");
  assert.equal(h.releases, 1);
});
test("INSERT failure rolls back and releases", async () => {
  const h = harness({ failInsert: true });
  await assert.rejects(h.api.tryInsertDaily100Claim(args), /INSERT_FAILED/);
  assert.equal(h.calls.at(-1), "ROLLBACK");
  assert.equal(h.releases, 1);
});
test("disabled guard prevents connecting", async () => {
  const h = harness({ block: true });
  await assert.rejects(h.api.tryInsertDaily100Claim(args), /BLOCKED/);
  assert.equal(h.connections, 0);
});
