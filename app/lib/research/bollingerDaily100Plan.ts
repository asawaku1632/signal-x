/**
 * Offline-only deterministic planning for a daily 100-stock forward study.
 * No database, provider, clock, scheduler, or production runner imports.
 */
export const DAILY_100_PARTITION_SIZE = 20;
export const DAILY_100_MAX_CONCURRENCY = 3;
export const DAILY_100_SOURCE_TIMEOUT_MS = 12_000;

export function buildDaily100Partitions(codes: readonly string[]) {
  if (codes.length !== 100 || new Set(codes).size !== 100 ||
      codes.some(code => !/^\d{4}$/.test(code))) {
    throw new Error("DAILY_100_UNIVERSE_INVALID");
  }
  const batches: { partitionId: number; codes: string[] }[] = [];
  for (let offset = 0; offset < codes.length; offset += DAILY_100_PARTITION_SIZE) {
    batches.push({
      partitionId: offset / DAILY_100_PARTITION_SIZE,
      codes: codes.slice(offset, offset + DAILY_100_PARTITION_SIZE),
    });
  }
  return batches;
}

export function validateDaily100RequestBudget(
  sampled: number, pending: number, maxPending = 10,
) {
  if (![sampled, pending, maxPending].every(Number.isSafeInteger) ||
      sampled < 0 || pending < 0 || maxPending < 0 ||
      sampled > DAILY_100_PARTITION_SIZE || pending > maxPending) {
    throw new Error("DAILY_100_REQUEST_BUDGET_EXCEEDED");
  }
  return sampled + pending;
}

export function daily100ClaimKey(
  tradingDate: string, partitionId: number, policyVersion: string,
) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(tradingDate) ||
      !Number.isInteger(partitionId) || partitionId < 0 || partitionId > 4 ||
      !/^BB_DAILY_100_[A-Z0-9_]+$/.test(policyVersion)) {
    throw new Error("DAILY_100_CLAIM_INVALID");
  }
  return `${policyVersion}:${tradingDate}:${partitionId}`;
}
