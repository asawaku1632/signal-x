import { validateProspectiveSnapshot, type ProspectiveSnapshotInput } from "./marketRelativeProspectiveSnapshot";

export function buildSnapshotInsertPlan(input: ProspectiveSnapshotInput) {
  const errors = validateProspectiveSnapshot(input);
  if (errors.length) return { ok: false as const, errors };
  return {
    ok: true as const,
    sql: "INSERT INTO public.market_relative_prospective_ledger (signal_id, code, ai_power, price, price_observed_at, signal_observed_at, captured_at, source, version) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT (signal_id) DO NOTHING RETURNING signal_id",
    params: [input.signalId, input.code, input.aiPower, input.price, input.priceObservedAt, input.signalObservedAt, input.capturedAt, input.source, input.version],
  };
}
