import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const evidence = readFileSync(join(root, "app/lib/research/doubleBottomEvidence.ts"), "utf8");
const audit = readFileSync(join(root, "app/admin/shape-precision-audit/page.tsx"), "utf8");
const replay = readFileSync(join(root, "app/admin/shape-precision-audit/replay/page.tsx"), "utf8");

test("4 evidence classes are mutually ordered and missing reasons stay unknown", () => {
  for (const part of [
    '"BREAKOUT_RECORDED"', '"NEAR_NECKLINE"', '"REBOUND_ONLY"', '"INSUFFICIENT"',
    'reasons.includes("ネックラインを上抜け")',
    'reasons.includes("ネックライン付近まで回復")',
    'reasons.includes("近い価格帯で2回下げ止まり")',
    'if (!reasons?.length) return "INSUFFICIENT";'
  ]) assert.ok(evidence.includes(part), part);
  const breakoutIndex = evidence.indexOf('if (reasons.includes("ネックラインを上抜け"))');
  const nearIndex = evidence.indexOf('if (reasons.includes("ネックライン付近まで回復"))');
  const reboundIndex = evidence.indexOf('if (reasons.includes("近い価格帯で2回下げ止まり"))');
  assert.ok(breakoutIndex < nearIndex && nearIndex < reboundIndex);
});

test("audit can filter 4 classes without mutating stored scan or AI results", () => {
  assert.match(audit, /const selectedStage: DoubleBottomStage \| null/);
  assert.match(audit, /DOUBLE_BOTTOM_STAGES\.map/);
  assert.match(audit, /\?pattern=\$\{doubleBottomId\}&stage=\$\{item\.value\}/);
  assert.match(audit, /allMatches\.filter\(\(match\) => match\.stage === selectedStage\)/);
  assert.doesNotMatch(audit, /\b(?:INSERT\s+INTO|UPDATE\s+|DELETE\s+FROM|runScan\s*\()/i);
});

test("replay is owner-only, one stock per click, and read-only", () => {
  assert.match(replay, /getLearningOwnerSession\(\)/);
  assert.ok(replay.indexOf("if (!isOwner) notFound()") < replay.indexOf("await loadEvidence(code, at)"));
  assert.match(replay, /FROM display_snapshots/);
  assert.match(replay, /WHERE d\.snapshot_key = \$1 AND x\.value->>'code' = \$2/);
  assert.match(replay, /timestamp !== at/);
  assert.match(replay, /WHERE p\.value->>'id'='pattern002'/);
  assert.match(replay, /range=3mo&interval=1d/);
  assert.match(replay, /cache: "no-store"/);
  assert.match(replay, /jstDate\(time\) >= scanDate/);
  assert.match(replay, /検出当時の完全再現ではありません/);
  assert.match(replay, /正しかったように見せない|午後の値動きを含むおそれ/);
  assert.doesNotMatch(replay, /\b(?:INSERT\s+INTO|UPDATE\s+|DELETE\s+FROM|runScan\s*\(|saveDisplaySnapshot\s*\()/i);
});

test("sample cards link to the restricted replay and to regular chart", () => {
  assert.match(audit, /\/admin\/shape-precision-audit\/replay\?code=/);
  assert.match(audit, /&at=\$\{encodeURIComponent\(snapshot\.updatedAt \?\? ""\)\}/);
  assert.match(audit, /\/chart\/\$\{stock\.code\}/);
  assert.match(audit, /Math\.min\(patternId === doubleBottomId/);
});
