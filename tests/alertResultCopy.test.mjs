import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const page = fs.readFileSync("app/alerts/result/[code]/page.tsx", "utf8");

test("alert result page explains why current analysis may differ", () => {
  assert.match(page, /以前に成立した買いシグナルの結果/);
  assert.match(page, /現在のAI評価は、この通知が発生した時点の評価とは別物/);
});
