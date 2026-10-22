// Pure, offline research comparison. No credentials, network, or database access.
export const HISTORICAL_REFERENCE_3996_20260701 = Object.freeze({
  O: 173, H: 175, L: 173, C: 175, Vo: 7000,
});
const fields = ["O", "H", "L", "C", "Vo"] as const;
type Field = (typeof fields)[number];
type Bar = Record<string, unknown>;
export type CompareResult = "REFERENCE_MATCH" | "REFERENCE_MISMATCH" | "FIELDS_MISSING" | "WRONG_BAR";
export function compareHistoricalBar(bar: unknown): CompareResult {
  if (!bar || typeof bar !== "object") return "WRONG_BAR";
  const b = bar as Bar;
  if (b.Code !== "39960" || b.Date !== "2026-07-01") return "WRONG_BAR";
  if (!fields.every((k: Field) => typeof b[k] === "number" && Number.isFinite(b[k]))) return "FIELDS_MISSING";
  return fields.every((k: Field) => b[k] === HISTORICAL_REFERENCE_3996_20260701[k]) ? "REFERENCE_MATCH" : "REFERENCE_MISMATCH";
}
