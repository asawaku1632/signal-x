import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const audit = readFileSync(join(root, "app/admin/shape-precision-audit/page.tsx"), "utf8");
const hub = readFileSync(join(root, "app/admin/learning-hub/page.tsx"), "utf8");
const engine = readFileSync(join(root, "app/lib/chartPatternEngine.ts"), "utf8");

test("private audit authenticates owner before database queries", () => {
  assert.match(audit, /getLearningOwnerSession\(\)/);
  assert.match(audit, /if \(!isOwner\) notFound\(\)/);
  assert.ok(audit.indexOf("if (!isOwner) notFound()") < audit.indexOf("await Promise.all([loadSnapshot(), loadForwardHealth()])"));
  assert.match(hub, /href: "\/admin\/shape-precision-audit"/);
});

test("audit stays read-only without refreshing the live scan or learning state", () => {
  assert.match(audit, /FROM display_snapshots/);
  assert.match(audit, /FROM pattern_forward_observations/);
  assert.doesNotMatch(audit, /\b(?:INSERT|UPDATE|DELETE|TRUNCATE|MERGE)\s+(?:INTO|FROM|TABLE|public\.)/i);
  assert.doesNotMatch(audit, /\b(?:refreshScanSnapshot|runScan|runAiPipeline|refreshPatternForwardStats|updatePatternForwardOutcomes|saveDisplaySnapshot)\s*\(/);
  assert.doesNotMatch(audit, /\bfetch\s*\(/);
});

test("completeness limits and no implied win-probability are explicit", () => {
  assert.match(audit, /理由そのものが未保存/);
  assert.match(audit, /理由がないだけで「突破していない」とは断定できません/);
  assert.match(audit, /将来上昇確率ではありません/);
  assert.match(audit, /未来の勝率は確定できません/);
  assert.match(audit, /チャートを開いて目視確認/);
  assert.match(audit, /最大15銘柄/);
});

test("existing double-bottom detection is unchanged and audited against its conditions", () => {
  assert.match(engine, /function detectDoubleBottom/);
  assert.match(engine, /distance < 4 \|\| distance > 60/);
  assert.match(engine, /percentDifference\(first.price, second.price\) <= 0\.035/);
  assert.match(engine, /latest.close >= second.price \* 1\.01/);
  assert.match(audit, /過去60本以内/);
  assert.match(audit, /差3\.5%以内/);
});
