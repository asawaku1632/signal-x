import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const page=readFileSync("app/admin/dual-surge-shadow/page.tsx","utf8");
const client=readFileSync("app/admin/dual-surge-shadow/DualSurgeClient.tsx","utf8");
test("dashboard is owner gated",()=>{assert.match(page,/getLearningOwnerSession/);assert.match(page,/if\(!isOwner\)notFound\(\)/);});
test("dashboard is fail-closed and does not manufacture results",()=>{assert.match(client,/RESEARCH_DISABLED/);assert.match(client,/検証済みの結果はありません/);assert.match(client,/PRE_SURGE_V1/);assert.match(client,/SURGE_START_V1/);assert.doesNotMatch(client,/Math\.random|仮の勝率|fetch\(.*POST/);});
