import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";

const source = readFileSync(join(process.cwd(), "app/lib/research/bollingerDaily100DbGuard.ts"), "utf8");
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const moduleExports = {};
new Function("exports", js)(moduleExports);
const { assertDaily100DevDatabase } = moduleExports;
const devUrl = "postgresql://postgres.jdtqwryiyxeuoraecorw:dummy@aws-0-ap-northeast-1.pooler.supabase.com:6543/postgres";
const prodUrl = "postgresql://postgres.paygtakajhvatwejygda:dummy@aws-0-ap-northeast-1.pooler.supabase.com:6543/postgres";

test("production deployment rejected even with explicit write flag and dev URL", () => {
  assert.throws(() => assertDaily100DevDatabase({
    VERCEL_ENV: "production", BB_DAILY100_DB_WRITE_ENABLED: "true", DATABASE_URL: devUrl,
  }), /DAILY100_DEV_DB_WRITE_BLOCKED/);
});
test("write disabled by default", () => {
  assert.throws(() => assertDaily100DevDatabase({
    VERCEL_ENV: "preview", DATABASE_URL: devUrl,
  }), /DAILY100_DEV_DB_WRITE_BLOCKED/);
});
test("production database identity rejected", () => {
  assert.throws(() => assertDaily100DevDatabase({
    VERCEL_ENV: "preview", BB_DAILY100_DB_WRITE_ENABLED: "true", DATABASE_URL: prodUrl,
  }), /DAILY100_DEV_DB_PROJECT_MISMATCH/);
});
test("correct dev database identity accepted in preview when explicitly enabled", () => {
  assert.doesNotThrow(() => assertDaily100DevDatabase({
    VERCEL_ENV: "preview", BB_DAILY100_DB_WRITE_ENABLED: "true", DATABASE_URL: devUrl,
  }));
});
test("malformed URL and invalid scheme rejected", () => {
  const base = { VERCEL_ENV: "preview", BB_DAILY100_DB_WRITE_ENABLED: "true" };
  assert.throws(() => assertDaily100DevDatabase({ ...base, DATABASE_URL: "not-a-url" }), /DAILY100_DEV_DB_URL_INVALID/);
  assert.throws(() => assertDaily100DevDatabase({ ...base, DATABASE_URL: "https://jdtqwryiyxeuoraecorw.example.com" }), /DAILY100_DEV_DB_URL_INVALID/);
});
