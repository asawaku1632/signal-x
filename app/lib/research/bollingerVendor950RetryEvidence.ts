/** Research-only manually observed retry evidence, 2026-10-17.
 * All ten batches (0..9) submitted; batch 6 was submitted twice with the same outcomes.
 * Original 950-stock acquisition evidence is immutable.
 * No production, DB, cron, LINE or trading actions.
 */
export const BB_VENDOR_950_FAILURE_RETRY_SUMMARY = {
  universeVersion: "BB_VENDOR_PROBE_950_V1",
  mode: "OWNER_PREVIEW_READ_ONLY_MANUAL_950_FAILURE_RETRY",
  batchesCompleted: 10,
  uniqueCodesRetested: 47,
  recovered: 0,
  providerHttp404Persisted: 46,
  insufficientPriceHistoryPersisted: 1,
  unchangedHistoricalEvidence: true,
  listingStatus: "UNVERIFIED",
  dailyAutomationValidated: false,
} as const;

export const BB_VENDOR_950_RETRY_BATCH_RESULTS = [
  { batch: 0, requested: 5, recovered: 0 },
  { batch: 1, requested: 5, recovered: 0 },
  { batch: 2, requested: 5, recovered: 0 },
  { batch: 3, requested: 5, recovered: 0 },
  { batch: 4, requested: 5, recovered: 0 },
  { batch: 5, requested: 5, recovered: 0 },
  { batch: 6, requested: 5, recovered: 0 },
  { batch: 7, requested: 5, recovered: 0 },
  { batch: 8, requested: 5, recovered: 0 },
  { batch: 9, requested: 2, recovered: 0 },
] as const;

export function verifyBbVendor950RetryEvidence(): boolean {
  return BB_VENDOR_950_RETRY_BATCH_RESULTS.length === 10
    && BB_VENDOR_950_RETRY_BATCH_RESULTS.every((r, i) =>
      r.batch === i && r.requested === (i === 9 ? 2 : 5) && r.recovered === 0)
    && BB_VENDOR_950_RETRY_BATCH_RESULTS.reduce((sum, r) => sum + r.requested, 0) === 47
    && BB_VENDOR_950_FAILURE_RETRY_SUMMARY.providerHttp404Persisted +
       BB_VENDOR_950_FAILURE_RETRY_SUMMARY.insufficientPriceHistoryPersisted === 47;
}
