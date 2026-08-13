export const DAILY_SCAN_MIN_COVERAGE_RATIO = 0.8;

export function minimumDailyScanCount(expectedCount: number) {
  return Math.max(1, Math.ceil(expectedCount * DAILY_SCAN_MIN_COVERAGE_RATIO));
}

export function validateDailyScanCoverage(
  actualCount: number,
  expectedCount: number,
) {
  const minimumCount = minimumDailyScanCount(expectedCount);
  return {
    valid: actualCount >= minimumCount,
    actualCount,
    expectedCount,
    minimumCount,
  };
}
