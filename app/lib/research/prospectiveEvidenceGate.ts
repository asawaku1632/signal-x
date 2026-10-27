// Research-only, pure evidence classification. No persistence or production writes.
export type ProspectiveEvidence = {
  signalObservedAt: string | null;
  priceObservedAt: string | null;
  capturedAt: string | null;
  provider: string | null;
  modelVersion: string | null;
  signalDate: string;
  barEndAt: string | null;
};
export type EvidenceDecision = { eligible: boolean; reason: string };
const validTime = (value: string | null): number | null => {
  if (!value) return null;
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : null;
};
export function classifyProspectiveEvidence(row: ProspectiveEvidence): EvidenceDecision {
  const signal = validTime(row.signalObservedAt);
  const quote = validTime(row.priceObservedAt);
  const captured = validTime(row.capturedAt);
  const barEnd = validTime(row.barEndAt);
  if (signal === null || quote === null || captured === null || barEnd === null)
    return { eligible: false, reason: "MISSING_OR_INVALID_TIMESTAMP" };
  if (!row.provider?.trim() || !row.modelVersion?.trim())
    return { eligible: false, reason: "MISSING_PROVENANCE" };
  if (!/^\\d{4}-\\d{2}-\\d{2}$/.test(row.signalDate))
    return { eligible: false, reason: "INVALID_SIGNAL_DATE" };
  if (quote > signal || barEnd > signal)
    return { eligible: false, reason: "FUTURE_PRICE_LEAKAGE" };
  if (captured < signal || captured - signal > 5 * 60 * 1000)
    return { eligible: false, reason: "NOT_CAPTURED_AT_SIGNAL_TIME" };
  const jstDate = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(signal));
  if (jstDate !== row.signalDate)
    return { eligible: false, reason: "SIGNAL_DATE_MISMATCH" };
  return { eligible: true, reason: "TIMESTAMP_AND_PROVENANCE_GATE_PASSED_ONLY" };
}
