/** Point-in-time data contract for research-only intraday observations. */
export const INTRADAY_OBSERVATION_VERSION = "INTRADAY_OBSERVATION_V1";
const finitePositive = (v) => typeof v === "number" && Number.isFinite(v) && v > 0;
export function validateIntradayObservation(input) {
  const { code, tradingDate, capturedAt, source, licenseStatus, quotePrice, observedAt, phase } = input ?? {};
  if (typeof code !== "string" || !/^\\d{4}$/.test(code)) return { status:"UNAVAILABLE", reason:"INVALID_CODE" };
  if (typeof tradingDate !== "string" || !/^\\d{4}-\\d{2}-\\d{2}$/.test(tradingDate))
    return { status:"UNAVAILABLE", reason:"INVALID_TRADING_DATE" };
  if (!finitePositive(quotePrice)) return { status:"UNAVAILABLE", reason:"INVALID_QUOTE" };
  if (typeof source !== "string" || !source.trim()) return { status:"UNAVAILABLE", reason:"MISSING_SOURCE" };
  if (licenseStatus !== "APPROVED") return { status:"UNAVAILABLE", reason:"PROVIDER_APPROVAL_REQUIRED" };
  if (!["MORNING","AFTERNOON"].includes(phase)) return { status:"UNAVAILABLE", reason:"INVALID_PHASE" };
  if (typeof capturedAt !== "string" || typeof observedAt !== "string" ||
      !/([+-]\\d{2}:\\d{2}|Z)$/.test(capturedAt) || !/([+-]\\d{2}:\\d{2}|Z)$/.test(observedAt))
    return { status:"UNAVAILABLE", reason:"MISSING_TIMEZONE" };
  const captureMs=Date.parse(capturedAt), observationMs=Date.parse(observedAt);
  if (!Number.isFinite(captureMs) || !Number.isFinite(observationMs) || observationMs > captureMs)
    return { status:"UNAVAILABLE", reason:"FUTURE_OR_INVALID_QUOTE" };
  const tokyoDate=new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Tokyo",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date(observationMs));
  if (tokyoDate !== tradingDate) return { status:"UNAVAILABLE", reason:"WRONG_TRADING_DAY" };
  return { status:"VALID", policyVersion:INTRADAY_OBSERVATION_VERSION,
    key:`${tradingDate}:${code}:${observedAt}:${source}`, quotePrice, phase };
}
