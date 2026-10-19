import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const analysis = readFileSync(new URL("../app/analysis/[code]/page.tsx", import.meta.url), "utf8");
const evidence = readFileSync(new URL("../app/components/analysis/SwingHistoricalEvidence.tsx", import.meta.url), "utf8");

test("swing evidence remains reachable after a decision downgrades to WATCH or AVOID", () => {
  assert.match(analysis, /<SwingHistoricalEvidence code=\{signal\.code\} \/>/);
  assert.doesNotMatch(analysis, /swingEntryDecision\.status === "CANDIDATE" && <SwingHistoricalEvidence/);
});
test("historical queries only load when the user expands the section", () => {
  assert.match(evidence, /if \(!expanded\) return;/);
  assert.match(evidence, /aria-expanded=\{expanded\}/);
  assert.match(evidence, /setExpanded\(!expanded\)/);
});
test("the user's stock history and global cohort stay clearly distinguished", () => {
  assert.match(evidence, /過去の全銘柄スイング候補/);
  assert.match(evidence, /保存済み簡易判定（直近3件）/);
  assert.match(evidence, /この銘柄自体の勝率や約定可能な利益を示すものではありません/);
});
