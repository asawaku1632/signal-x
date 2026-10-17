/** Manual Preview evidence for frozen 500-stock Yahoo Finance acquisition probe.
 * Source: 25 user-supplied batch=0..24 responses; no DB write.
 * Provider HTTP 404 does not establish delisting or bad predictions.
 */
export const BB_VENDOR_500_HTTP404_CODES = [
  "9613", "2412", "4384", "3141", "1809", "2651",
  "1949", "6028", "6201", "9719", "9783", "1821",
  "4453", "4974", "5486", "7518", "8279", "9749",
] as const;
export const BB_VENDOR_500_RESULT = {
  universeVersion: "BB_VENDOR_PROBE_500_V1",
  tested: 500, succeeded: 482, providerHttp404: 18,
  source: "MANUAL_OWNER_PREVIEW_25_BATCH_RESULTS",
  listingStatus: "UNVERIFIED",
} as const;
