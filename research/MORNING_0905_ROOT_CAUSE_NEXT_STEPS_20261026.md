# Morning 09:05 quote failure: code-grounded next steps (2026-10-26)

## Verified from research branch source

- `openingBars()` requests a 1-day Yahoo chart with 5-minute interval, 8-second timeout, and no retry.
- `runMorningFinalCheck()` irrevocably claims the morning job before network calls, at most five candidate calls; no replay/backfill.
- `MISSING_CANDLES` is emitted when timestamp array is missing **or** first quote object is absent; it does **not** establish that the 09:05 candle is missing.
- The new classifier is invoked after successful JSON parse but its result is discarded (`void diagnostic`). No observed production metadata yet supports attribution among missing 09:00 bar, missing 09:05 bar, quote array absent, or price fields invalid.
- HTTP non-OK responses throw before classifier invocation, and are reduced to `UPSTREAM_HTTP_ERROR`; timeout and other failures are also collapsed. A status-class-only diagnosis is possible without persisting raw payloads, but not yet wired.
- `tradeDate` passed to the classifier is generated using locale-dependent `Intl.DateTimeFormat(...).format(new Date())`; safer to construct YYYY-MM-DD from `formatToParts` and use the already gated trading date. This has not been changed.

## Research-only validation plan

1. Add deterministic offline fixtures for each failure path and malformed provider response. Include timezone/date rollover and empty/missing opening OHLC values.
2. Ensure classifier is side-effect-free and cannot turn a previously successful quote parsing path into a failure. If classification fails, preserve original result.
3. Design a bounded metadata-only result (reason, HTTP status class, timestamp count, 09:00/09:05 presence, run date) and validate access control. Do not persist symbol, raw payload, OHLCV, API credentials, or user data.
4. Do **not** activate extra requests or replay historical Yahoo calls. Verify provider license/terms before any additional data acquisition or storage. No production writes, notifications, scoring, ranking, cron or trade decisions without explicit approval.
5. Only after real, permitted observations exist, compare observed reason distribution and select the smallest correction, followed by shadow forward validation.

## Current conclusion

CI #7 passed according to the user-supplied Actions listing. This validates the workflow run, not real-time quote availability or cause of failures. Root cause remains undetermined.
