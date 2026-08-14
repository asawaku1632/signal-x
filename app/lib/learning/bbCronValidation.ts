const MIN_COVERAGE_RATIO = 0.8;

function validateCoverage(actualCount: number, expectedCount: number) {
  const minimumCount = Math.max(1, Math.ceil(expectedCount * MIN_COVERAGE_RATIO));
  return {
    valid: actualCount >= minimumCount,
    actualCount,
    expectedCount,
    minimumCount,
  };
}

export type BbSnapshotValidationInput = {
  targetDate: string;
  updatedAt: string;
  itemCount: number;
  stockCodes: string[];
  expectedCount: number;
  savedDailyCount: number;
};

export function getJstDateString(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function validateBbSnapshot(input: BbSnapshotValidationInput) {
  const parsedUpdatedAt = new Date(input.updatedAt);
  const snapshotDate = Number.isNaN(parsedUpdatedAt.getTime())
    ? null
    : getJstDateString(parsedUpdatedAt);
  const stockCoverage = validateCoverage(
    input.stockCodes.length,
    input.expectedCount,
  );
  const itemCoverage = validateCoverage(
    input.itemCount,
    input.expectedCount,
  );
  const duplicateCodes = Array.from(
    input.stockCodes.reduce<Map<string, number>>((counts, code) => {
      counts.set(code, (counts.get(code) ?? 0) + 1);
      return counts;
    }, new Map()),
  ).filter(([, count]) => count > 1).map(([code]) => code);

  let reason: string | null = null;
  if (!snapshotDate) reason = "INVALID_SNAPSHOT_UPDATED_AT";
  else if (snapshotDate !== input.targetDate) reason = "SNAPSHOT_DATE_MISMATCH";
  else if (duplicateCodes.length > 0) reason = "DUPLICATE_SNAPSHOT_CODES";
  else if (!itemCoverage.valid || !stockCoverage.valid) reason = "INSUFFICIENT_SNAPSHOT_COVERAGE";
  else if (input.savedDailyCount <= 0) reason = "DAILY_SNAPSHOT_NOT_SAVED";

  return {
    valid: reason === null,
    reason,
    snapshotDate,
    duplicateCodes,
    itemCoverage,
    stockCoverage,
    savedDailyCount: input.savedDailyCount,
  };
}
