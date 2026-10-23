import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const route=readFileSync("app/api/admin/dual-surge-shadow/route.ts","utf8");
test("owner-only and disabled by default",()=>{assert.match(route,/getLearningOwnerSession/);assert.match(route,/if \(!isOwner\)/);assert.match(route,/DUAL_SURGE_SHADOW_READ_ENABLED/);assert.match(route,/RESEARCH_DISABLED/);});
test("read-only no-store route",()=>{assert.match(route,/export async function GET/);assert.doesNotMatch(route,/export async function POST|INSERT INTO|UPDATE public|DELETE FROM/);assert.match(route,/private, no-store/);});
test("separate cohorts and completed-only outcomes",()=>{assert.match(route,/group by cohort/);assert.match(route,/o.status='COMPLETE'/);});
