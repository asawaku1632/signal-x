# 09:05 diagnostic metadata: research-only record design

Status: **DESIGN ONLY — NOT DEPLOYED, NOT WRITING TO DB**. Based on passing workflow runs #8 and #9. This document does not authorize production instrumentation or further Yahoo requests.

## Purpose

Distinguish upstream HTTP failure, missing timestamp/quote arrays, absent 09:00/09:05 candle, and presence of timestamps without validated OHLC. These reasons must remain distinct from a trading halt and must not imply price validity.

## Minimal proposed record

| Field | Type | Constraint |
|---|---|---|
| research_run_date | DATE | Tokyo exchange trading date, validated YYYY-MM-DD |
| stage | ENUM | existing_response / upstream_failure / parser_failure |
| reason | ENUM | allowlist from classifier plus UPSTREAM_TIMEOUT, JSON_PARSE_ERROR, CLASSIFIER_ERROR |
| http_status_class | ENUM | 2xx / 3xx / 4xx / 5xx / unknown |
| timestamp_count | INTEGER NULL | 0–75 or null; cap at 75 for research metadata |
| has_0900 | BOOLEAN NULL | null if response unavailable or invalid |
| has_0905 | BOOLEAN NULL | null if response unavailable or invalid |
| classifier_version | TEXT | immutable version string, e.g. metadata-v1 |
| recorded_at | TIMESTAMPTZ | server generated; operational timestamp only |

No ticker, name, raw payload, OHLCV, API key, user ID, access token, provider response body, or other potentially sensitive field. **Without ticker, the record supports run-level failure distributions only, not per-symbol attribution.** Keep the data separate from trading decisions and from any user-facing ranking.

## Failure path rules

- HTTP non-2xx: reason UPSTREAM_HTTP_ERROR, status class only; do not parse body.
- Request timeout: reason UPSTREAM_TIMEOUT, status class unknown; no additional request.
- JSON parse failure: JSON_PARSE_ERROR; no payload logging.
- 2xx JSON: use pure classifier; if classifier throws, CLASSIFIER_ERROR; never affect the existing quote decision.
- BARS_PRESENT_NOT_PRICE_VALIDATED means only timestamps exist; cannot mark a quote successful.
- Null vs false: null = not assessable; false = assessed and absent.

## Research-only gate before implementation

1. Confirm permitted provider use and metadata retention with license/terms owner. Yahoo unofficial endpoint is not automatically licensed for commercial or repeated use.
2. Choose **separate research database** or offline fixture first; no production schema change. Administrator-only access with default-deny policy, retention period, no public APIs.
3. Build deterministic tests proving failure-path handling, no new network calls, no raw data leakage, no changes to original morning outcome, and no retries.
4. Review migration/RLS/security independently; require explicit authorization before enabling any write, scheduled job, production instrumentation, or UI.
5. Collect enough *permitted* forward observations to measure the share of each reason; only then propose and test a targeted fix in shadow mode.

## Acceptance criteria

- Existing one-claim/five-request cap preserved.
- Metadata failure cannot change quoteStatus, trade signals, ranking, notifications, or source prices.
- Diagnostic failures never turn existing successful parse into a failure.
- No historical backfill or additional provider calls.
- No success claim for actual 09:05 capture until observed valid opening prices under an authorized data source.
