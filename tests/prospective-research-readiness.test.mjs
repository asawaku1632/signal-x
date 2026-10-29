import test from "node:test";import assert from "node:assert/strict";
import {summarizeProspectiveResearch as summarize} from "../app/lib/research/prospectiveResearchReadiness.mjs";
test("empty prospective evidence remains blocked",()=>{const r=summarize([]);assert.equal(r.stability.dates,0);assert.ok(r.blockers.includes("INSUFFICIENT_DATES"));assert.ok(r.blockers.includes("EXTERNAL_AUTHENTICATION_MISSING"));assert.equal(r.trainingEnabled,false);});
test("reported verification cannot authorize trading",()=>{const r=summarize([],{minDays:2,minMonths:2});assert.equal(r.tradingEnabled,false);assert.equal(r.notificationsEnabled,false);});
test("invalid month requirement rejected",()=>assert.throws(()=>summarize([],{minMonths:1}),/INVALID_MONTH_REQUIREMENT/));
test("invalid ledger input rejected",()=>assert.throws(()=>summarize(null),/INVALID_PROSPECTIVE_LEDGER/));
