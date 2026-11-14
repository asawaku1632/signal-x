// Forward-only research classification. No trade or notification effects.
export function classifyScanProvenance({ generatedAt, latestBarTimestamp, dataSource, learningAsOf }) {
  const cutoff = Date.parse(generatedAt);
  const seconds = Number(latestBarTimestamp);
  if (!Number.isFinite(cutoff) || !Number.isFinite(seconds) || seconds <= 0) {
    return { eligiblePost905: false, reason: "MISSING_OR_INVALID_TIMESTAMP" };
  }
  const barMs = seconds * 1000;
  if (barMs > cutoff) return { eligiblePost905: false, reason: "FUTURE_BAR" };
  if (dataSource !== "intraday") return { eligiblePost905: false, reason: "NOT_INTRADAY" };
  const jst = new Date(cutoff + 9 * 3600000);
  const day = jst.toISOString().slice(0, 10);
  const barJst = new Date(barMs + 9 * 3600000);
  const barDay = barJst.toISOString().slice(0, 10);
  if (day !== barDay) return { eligiblePost905: false, reason: "STALE_BAR" };
  const minute = barJst.getUTCHours() * 60 + barJst.getUTCMinutes();
  if (minute < 545) return { eligiblePost905: false, reason: "BEFORE_0905_BAR" };
  if (!learningAsOf || !Number.isFinite(Date.parse(learningAsOf))) {
    return { eligiblePost905: false, reason: "MISSING_LEARNING_ASOF" };
  }
  if (Date.parse(learningAsOf) > cutoff) return { eligiblePost905: false, reason: "FUTURE_LEARNING" };
  return { eligiblePost905: true, reason: "TIMESTAMPS_PASS_NOT_FULL_PROVENANCE" };
}
