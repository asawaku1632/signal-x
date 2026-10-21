// Research-only strict input adapter. No HTTP, credentials, database access, or writes.
import { compareResearchSampleRows } from "./independentPriceSampleBatch.mjs";

export const MAX_RESEARCH_INPUT_BYTES = 32_768;

export function reviewIndependentPriceJson(jsonText) {
  if (typeof jsonText !== "string" || Buffer.byteLength(jsonText, "utf8") > MAX_RESEARCH_INPUT_BYTES) {
    throw new Error("INVALID_RESEARCH_INPUT_SIZE");
  }
  let payload;
  try { payload = JSON.parse(jsonText); } catch { throw new Error("INVALID_RESEARCH_JSON"); }
  if (!payload || typeof payload !== "object" || Array.isArray(payload) ||
      payload.schemaVersion !== 1 || !Array.isArray(payload.rows)) {
    throw new Error("INVALID_RESEARCH_SCHEMA");
  }
  const permitted = new Set(["schemaVersion", "rows"]);
  if (Object.keys(payload).some((key) => !permitted.has(key))) {
    throw new Error("UNEXPECTED_RESEARCH_FIELD");
  }
  for (const row of payload.rows) {
    if (!row || typeof row !== "object" || Array.isArray(row)) throw new Error("INVALID_RESEARCH_ROW");
    const permittedRow = new Set([
      "code", "tradeDate", "signalReference", "independentClose",
      "independentCode", "independentDate", "independentSource",
      "samePriceBasis", "corporateActionReviewed", "retrievalTimestamp",
    ]);
    if (Object.keys(row).some((key) => !permittedRow.has(key))) {
      throw new Error("UNEXPECTED_RESEARCH_ROW_FIELD");
    }
    if (typeof row.samePriceBasis !== "boolean" || typeof row.corporateActionReviewed !== "boolean") {
      throw new Error("INVALID_RESEARCH_REVIEW_FLAGS");
    }
  }
  return compareResearchSampleRows(payload.rows);
}
