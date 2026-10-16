import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";

function loadTs(path, imports = {}) {
  const source = readFileSync(new URL(path, import.meta.url), "utf8");
  const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const module = { exports: {} };
  new Function("module", "exports", "require", js)(module, module.exports, key => {
    if (!(key in imports)) throw new Error("UNEXPECTED_IMPORT");
    return imports[key];
  });
  return module.exports;
}
const plan = loadTs("../app/lib/research/bollingerDaily100Plan.ts");
const { claimDaily100Partition } = loadTs("../app/lib/research/bollingerDaily100Claim.ts", {
  "./bollingerDaily100Plan": plan,
});
const universe = Array.from({ length: 100 }, (_, i) => String(1000 + i));
const base = {
  tradeDate: "2026-10-19", partitionId: 2, policyVersion: "BB_DAILY_100_V1",
  universe, enabled: true, activationDate: "2026-10-19",
};

test("disabled and not-activated states do not touch DB", async () => {
  const forbidden = async () => { throw new Error("DB_MUST_NOT_BE_CALLED"); };
  assert.equal((await claimDaily100Partition({ ...base, enabled: false, tryInsertClaim: forbidden })).state, "DISABLED");
  assert.equal((await claimDaily100Partition({ ...base, activationDate: "2026-10-20", tryInsertClaim: forbidden })).state, "NOT_ACTIVATED");
});
test("only one concurrent claimant may proceed", async () => {
  const uniqueKeys = new Set();
  const tryInsertClaim = async claim => {
    const key = [claim.tradeDate, claim.partitionId, claim.policyVersion].join(":");
    if (uniqueKeys.has(key)) return false;
    uniqueKeys.add(key);
    return true;
  };
  const results = await Promise.all(Array.from({ length: 10 }, () => claimDaily100Partition({ ...base, tryInsertClaim })));
  assert.equal(results.filter(r => r.state === "CLAIMED").length, 1);
  assert.equal(results.filter(r => r.state === "ALREADY_CLAIMED").length, 9);
  assert.deepEqual(results.find(r => r.state === "CLAIMED").codes, universe.slice(40, 60));
});
test("invalid partition fails before DB access", async () => {
  await assert.rejects(claimDaily100Partition({ ...base, partitionId: 5, tryInsertClaim: async () => { throw Error("DB_CALLED"); } }), /CLAIM_INVALID/);
});
