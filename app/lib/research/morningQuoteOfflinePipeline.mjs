// Offline fixture adapter only. No provider calls, persistence, or production integration.
import {classifyMorningQuoteFailure} from "./morningQuoteFailureMetadata.mjs";
import {summarizeMorningQuoteDiagnostics} from "./morningQuoteDiagnosisSummary.mjs";

function validDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(value+"T00:00:00Z");
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0,10) === value;
}

export function analyzeMorningFailureFixtures(fixtures) {
  if (!Array.isArray(fixtures)) throw new TypeError("fixtures must be an array");
  const records = [];
  let rejectedInput = 0;
  for (const fixture of fixtures) {
    if (!fixture || typeof fixture !== "object" || !validDate(fixture.tradeDate)) {
      rejectedInput++;
      continue;
    }
    const m = classifyMorningQuoteFailure(fixture);
    records.push({research_run_date:fixture.tradeDate,stage:m.stage,reason:m.reason,
      http_status_class:m.http_status_class,timestamp_count:m.timestamp_count,
      has_0900:m.has_0900,has_0905:m.has_0905,classifier_version:m.classifier_version});
  }
  const summary = summarizeMorningQuoteDiagnostics(records);
  return Object.freeze({accepted:summary.accepted,rejected:summary.rejected+rejectedInput,
    counts:summary.counts,priceValidityEstablished:false,rootCauseConfirmed:false,
    persistenceEnabled:false});
}
