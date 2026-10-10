import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { isSingleAccountLearningOwner } from "../app/lib/learningOwnerAccess.ts";

const read = (path) => readFileSync(path, "utf8");

test("strict owner check grants one account regardless of case or outer spaces", () => {
  assert.equal(isSingleAccountLearningOwner("user@example.com", "user@example.com"), true);
  assert.equal(isSingleAccountLearningOwner(" USER@EXAMPLE.COM ", "user@example.com"), true);
  assert.equal(isSingleAccountLearningOwner("other@example.com", "user@example.com"), false);
  assert.equal(isSingleAccountLearningOwner(null, "user@example.com"), false);
  assert.equal(isSingleAccountLearningOwner("user@example.com", ""), false);
  assert.equal(isSingleAccountLearningOwner("user@example.com", undefined), false);
  assert.equal(isSingleAccountLearningOwner("user@example.com", "user@example.com,second@example.com"), false);
  assert.equal(isSingleAccountLearningOwner("user@example.com", "user@example.com secondary@example.com"), false);
});

test("private hub fails closed; does not grant access from the broader admin list", () => {
  const owner = read("app/lib/learningOwner.ts");
  const page = read("app/admin/learning-hub/page.tsx");
  const menu = read("app/menu/page.tsx");
  assert.match(owner, /SIGNALX_LEARNING_OWNER_EMAIL \|\| process\.env\.ADMIN_EMAIL/);
  assert.doesNotMatch(owner, /process\.env\.ADMIN_EMAILS/);
  assert.match(owner, /isSingleAccountLearningOwner\(email, configuredOwner\)/);
  assert.match(page, /getLearningOwnerSession\(\)/);
  assert.match(page, /if \(!isOwner\) notFound\(\)/);
  assert.match(menu, /isLearningOwnerEmail\(email\)/);
  assert.match(menu, /\{isLearningOwner \?/);
  assert.match(menu, /href: "\/admin\/learning-hub"/);
});

test("learning hub includes core research, conflicts, and quality links", () => {
  const page = read("app/admin/learning-hub/page.tsx");
  for (const path of [
    "/simulation/conflict-check", "/simulation/exit-check", "/simulation/universe-check",
    "/admin/momentum-memory", "/admin/research-lab", "/admin/golden-zone",
    "/admin/pattern-performance", "/admin/learning-status", "/admin/daily-price-audit",
  ]) {
    assert.ok(page.includes(path), `missing ${path}`);
  }
  assert.match(page, /revalidate = 0/);
});
