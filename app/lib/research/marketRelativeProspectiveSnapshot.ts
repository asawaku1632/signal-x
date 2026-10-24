export type ProspectiveSnapshotInput = {
  signalId: string;
  code: string;
  aiPower: number;
  price: number;
  priceObservedAt: string;
  signalObservedAt: string;
  capturedAt: string;
  source: string;
  version: string;
};

export function validateProspectiveSnapshot(row: ProspectiveSnapshotInput): string[] {
  const errors: string[] = [];
  const timestamp = (value: string) =>
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value)
      ? Date.parse(value) : NaN;
  const priceTime = timestamp(row.priceObservedAt);
  const signalTime = timestamp(row.signalObservedAt);
  const capturedTime = timestamp(row.capturedAt);
  if (!row.signalId.trim() || !/^\d{4}$/.test(row.code)) errors.push("identity");
  if (!Number.isFinite(row.aiPower) || row.aiPower < 0 || row.aiPower > 100) errors.push("ai_power");
  if (!Number.isFinite(row.price) || row.price <= 0) errors.push("price");
  if (!row.source.trim() || !row.version.trim()) errors.push("provenance");
  if (![priceTime, signalTime, capturedTime].every(Number.isFinite)) errors.push("timestamp");
  else {
    if (priceTime > signalTime || signalTime > capturedTime) errors.push("time_order");
    if (signalTime - priceTime > 20 * 60_000) errors.push("stale_price");
    if (capturedTime - signalTime > 60_000) errors.push("late_capture");
  }
  return errors;
}
