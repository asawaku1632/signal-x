#!/usr/bin/env node
// Local-only research utility: reads a JSON file and prints a redacted comparison summary.
// No provider requests, credentials, DB operations, or verified-return publication.
import { readFile, stat } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { reviewIndependentPriceJson, MAX_RESEARCH_INPUT_BYTES } from "../app/lib/research/independentPriceInputAdapter.mjs";

export async function reviewPriceEvidenceFile(filePath) {
  if (typeof filePath !== "string" || !filePath.endsWith(".json")) throw new Error("EXPECTED_JSON_FILE");
  const absolute = resolve(filePath);
  const info = await stat(absolute);
  if (!info.isFile() || info.size > MAX_RESEARCH_INPUT_BYTES) throw new Error("INVALID_RESEARCH_INPUT_SIZE");
  const report = reviewIndependentPriceJson(await readFile(absolute, "utf8"));
  // No raw prices or source identifiers in output, to avoid accidental disclosure.
  return {
    total: report.total,
    reviewRequired: report.reviewRequired,
    comparableForManualReview: report.comparableForManualReview,
    verifiedReturns: 0,
    reasonCounts: report.reasonCounts,
    notice: "Local research comparison only; no prices have been independently verified.",
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  if (process.argv.length !== 3) {
    process.stderr.write("Usage: node scripts/review-independent-price-evidence.mjs <local-json-file>\n");
    process.exitCode = 2;
  } else {
    try {
      const report = await reviewPriceEvidenceFile(process.argv[2]);
      process.stdout.write(JSON.stringify(report, null, 2) + "\n");
    } catch (error) {
      process.stderr.write("Research evidence rejected: " + (error?.message ?? "UNKNOWN_ERROR") + "\n");
      process.exitCode = 1;
    }
  }
}
