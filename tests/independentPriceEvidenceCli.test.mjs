import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { reviewPriceEvidenceFile } from "../scripts/review-independent-price-evidence.mjs";

test("local evidence review returns aggregate counts without exposing prices", async () => {
  const dir = await mkdtemp(join(tmpdir(), "signalx-evidence-"));
  try {
    const path = join(dir, "sample.json");
    await writeFile(path, JSON.stringify({ schemaVersion: 1, rows: [{
      code: "3996", tradeDate: "2026-10-20", signalReference: 250,
      independentClose: 249, independentCode: "3996", independentDate: "2026-10-20",
      independentSource: "manual-independent-daily-reference", samePriceBasis: false,
      corporateActionReviewed: false, retrievalTimestamp: "2026-10-21T08:00:00Z",
    }] }));
    const report = await reviewPriceEvidenceFile(path);
    assert.equal(report.total, 1);
    assert.equal(report.verifiedReturns, 0);
    assert.equal(report.reviewRequired, 1);
    assert.equal(JSON.stringify(report).includes("249"), false);
    assert.equal(JSON.stringify(report).includes("manual-independent"), false);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("rejects invalid extension before reading any data", async () => {
  await assert.rejects(reviewPriceEvidenceFile("/tmp/example.txt"), /EXPECTED_JSON_FILE/);
});
