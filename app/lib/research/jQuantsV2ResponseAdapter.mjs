// Offline adapter for the documented J-Quants v2 daily-bar response envelope.
// No network access, credentials, persistence, or verified-return publication.
import { reviewJQuantsDailyBarSample } from "./jQuantsDailyBarOfflineAdapter.mjs";

export function reviewJQuantsV2DailyResponse({ response, sample, retrievalTimestamp }) {
  if (!response || typeof response !== "object" || Array.isArray(response) ||
      !Array.isArray(response.data) || response.data.length !== 1 ||
      (response.pagination_key !== undefined && response.pagination_key !== null)) {
    throw new Error("INVALID_OR_PAGINATED_JQUANTS_RESPONSE");
  }
  if (!sample || !/^\d{4}$/.test(String(sample.code ?? "")) ||
      !/^\d{4}-\d{2}-\d{2}$/.test(String(sample.tradeDate ?? ""))) {
    throw new Error("INVALID_JQUANTS_SAMPLE");
  }
  const bar = response.data[0];
  if (!bar || typeof bar !== "object" || Array.isArray(bar)) throw new Error("INVALID_JQUANTS_BAR");
  const providerCode = String(bar.Code ?? "");
  const code = /^\d{4}0$/.test(providerCode) ? providerCode.slice(0, 4) : providerCode;
  if (code !== sample.code || bar.Date !== sample.tradeDate) {
    throw new Error("JQUANTS_CODE_DATE_MISMATCH");
  }
  // A daily adjusted close is not equivalent to the intraday activation reference.
  return reviewJQuantsDailyBarSample({ rows: [{
    code: sample.code, tradeDate: sample.tradeDate,
    signalReference: sample.signalReference, bar, retrievalTimestamp,
  }] });
}
