import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = path => readFileSync(join(root, path), "utf8");

test("diagram actually illustrates two labeled lows and neckline but is labelled schematic", () => {
  const diagram = read("app/components/patterns/DoubleBottomVisualLesson.tsx");
  assert.match(diagram, /底①/);
  assert.match(diagram, /底②/);
  assert.match(diagram, /ネックライン/);
  assert.match(diagram, /架空の値動き/);
  assert.match(diagram, /教材であり、SIGNALXの検出結果・売買サインではありません/);
  const pattern = read("app/learning/patterns/[patternId]/page.tsx");
  assert.match(pattern, /pattern\.id === "pattern002"/);
  assert.match(pattern, /<DoubleBottomVisualLesson/);
});

test("three-question visual quiz gives feedback with no fake win rate", () => {
  const quiz = read("app/components/learning/ChartPatternQuiz.tsx");
  assert.match(quiz, /const questions: Question\[\]/);
  assert.equal((quiz.match(/answer: [012],/g) ?? []).length, 3);
  assert.match(quiz, /setSelected\(i\)/);
  assert.match(quiz, /aria-pressed=\{chosen\}/);
  assert.match(quiz, /question\.reason/);
  assert.match(quiz, /selected === question\.answer/);
  assert.match(quiz, /setFinished\(true\)/);
  assert.match(quiz, /restart/);
  assert.match(quiz, /架空のチャート/);
  const page = read("app/learning/chart-quiz/page.tsx");
  assert.match(page, /<ChartPatternQuiz/);
  assert.match(page, /<BottomNav/);
});

test("quiz and pattern explanation are navigable from learning and stock chart", () => {
  const learning = read("app/learning/page.tsx");
  const catalog = read("app/learning/patterns/page.tsx");
  const guide = read("app/components/analysis/AnalysisVisualGuide.tsx");
  assert.match(learning, /href="\/learning\/chart-quiz"/);
  assert.match(catalog, /href="\/learning\/chart-quiz"/);
  assert.match(guide, /href="\/learning\/chart-quiz"/);
  assert.match(guide, /learning\/patterns\/pattern002\?code=/);
  assert.match(guide, /ダブルボトムの「底①・底②」を自動認定したものではありません/);
  assert.match(guide, /fetch\("\/api\/chart\//);
});
