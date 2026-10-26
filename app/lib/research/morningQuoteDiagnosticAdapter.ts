import {classifyFiveMinuteMetadata, type QuoteMetadata} from "./morningQuoteMetadata";

/**
 * Research-only, side-effect-free adapter for an already received chart response.
 * Never makes a request, logs raw data, or modifies the morning capture runner.
 */
export function diagnoseExistingMorningResponse(
  payload: unknown,
  status: number,
  tradeDate: string,
): Readonly<QuoteMetadata> {
  return classifyFiveMinuteMetadata(payload, status, tradeDate);
}
