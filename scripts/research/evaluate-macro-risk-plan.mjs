#!/usr/bin/env node
/** Offline, read-only analysis of an explicitly captured as-of JSON evidence file. */
import {readFileSync} from "node:fs";
import {assessMacroRisk} from "../../app/lib/research/macroRiskEntryGate.mjs";
const file=process.argv[2];
if (!file || process.argv.length!==3) {
  console.error("Usage: node scripts/research/evaluate-macro-risk-plan.mjs <captured-evidence.json>");
  process.exitCode=2;
} else {
  try {
    const payload=JSON.parse(readFileSync(file,"utf8"));
    console.log(JSON.stringify(assessMacroRisk(payload),null,2));
  } catch (error) {
    console.error("MACRO_RISK_EVALUATION_FAILED: " + (error instanceof Error ? error.message : String(error)));
    process.exitCode=1;
  }
}
