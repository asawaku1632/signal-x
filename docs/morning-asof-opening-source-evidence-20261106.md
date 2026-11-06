# 09:08 opening-bar source evidence — immutable forward research (2026-11-06)

**DRAFT / SHADOW ONLY.** This change makes *future* 09:08 captures explainable; it does **not** recover missing historical candles, activate a live 09:05 recommendation, change brokerage orders or amend frozen research history.

## Finding from the real production archive (SELECT-only)

For 2026-10-21 through 2026-11-06, `morning_final_check_runs` contains 12 trading dates and 60 stored candidate observations:

| Stored reason | Stock-days | Dates | BUY_CANDIDATE | Precise request/receipt metadata |
| --- | ---: | ---: | ---: | ---: |
| MISSING_CANDLES | 50 | 10 | 0 | 0 |
| UNSPECIFIED | 10 | 2 | 0 | 0 |

The captures were *claimed* around 09:08:15 JST, not verified filled at 09:05. The old `MISSING_CANDLES` reason cannot distinguish which opening slot was absent; the 10 UNSPECIFIED items cannot be reclassified after the fact. Archived results stay unchanged.

The exact replayable SQL, verified using SELECT against the production `signal-x` Supabase on 2026-11-06, is `scripts/research/morning-opening-source-health-20261106.sql`. **Do not write individual owner's portfolio records into the repository.**

## Future capture changes

`app/lib/research/morningOpeningSourceEvidence.mjs` checks the real upstream response, exchange timezone, request/receipt JST time, presence and uniqueness of the 09:00 and 09:05 bars, and validity of 09:00 OHLCV / 09:05 OPEN. It rejects future/unfinished bars and contradictory or invalid timestamps.

`morningFinalCheckRunner.ts` now adds an immutable nested `quoteEvidence` object to each newly captured morning observation, alongside `quoteReason`:

- `requestedAt` and `receivedAt` are actual recorded server instants; neither is an upstream quote publication guarantee.
- `observedSlots`, `missingSlots` and explicit reason (for example `MISSING_0905_BAR`, `MISSING_0900_BAR`, `INVALID_0900_OHLCV`, `DUPLICATE_OPENING_SLOTS`, `UNVERIFIED_EXCHANGE_TIMEZONE`, `OUTSIDE_0908_CAPTURE_WINDOW`).
- Source identified as `YAHOO_V8_CHART_5M`; `executableFillVerified=false` and `officialSourceVerified=false`.
- Only completed 09:00 OHLCV and the **09:05 OPEN** are passed to the *unchanged* classifier. Future 09:05 high/low/close/volume and 09:10 onwards are erased before classification.
- Errors/timeouts stay `UNAVAILABLE`, not `SKIP` or an inferred winning/losing trade. Existing one-time `PENDING -> CLAIMED` behavior is unchanged; no retry or backfill.
- The nested metadata uses the existing JSONB column; no schema change, no additional provider subscription, no extra market-data HTTP calls.

**Most important:** Yahoo may not return the opening bars by 09:08. This is not a bug that can be cured by falsely timestamping an afternoon fetch as 09:08. The project has a separate owner-initiated, as-of-receipt 09:15–09:30 source probe in `/admin/night-morning-watch`. Later evidence may diagnose provider delay, but may **not** change the historical 09:05 decision or imply an executable 09:05 entry. Delayed historical J-Quants minute bars cannot certify a live first-five-minute fill.

## Verification and release gates

Run:

    node --test tests/morningFinalCheck.test.mjs tests/morningOpeningSourceEvidence.test.mjs

The PR updates the existing `morning-final-check-ci.yml` workflow to include the new tests and TypeScript check. Confirm GitHub CI before considering merge. In synthetic tests, future bar values, duplicates, malformed responses, wrong timezone and out-of-window responses must all fail closed.

Before any production buy gate or notification changes, require:
1. Ten or more independently captured forward trading dates including non-crash and crash regimes, with identifiable source timestamps and *nonzero* verified opening-price coverage.
2. As-of first-bar logic with no future data; compare delayed shadow alternatives from 09:15 separately, never backdating.
3. Evidence of entry feasibility **after** the data was observed, including bid/ask, liquidity, fees, gaps and signed source rights.
4. Complete risk/opportunity-cost comparisons on frozen candidates with PENDING future outcomes hidden until mature; independent out-of-sample review and owner approval.

The new source audit is **data-quality research**, not evidence of profitable trading. This draft PR changes no active alerts, AI POWER, notification rules, portfolios, trading accounts, cron times or deployed main branch.
