# 09:15 manual completed-bar × US shock watch — shadow only

Status: **research draft, no actual buy signal, no merge to main, no push, no order**.
Date of initial implementation: 2026-11-06. This is separate from PR #313 (macro entry shadow) and PR #314 (09:08 source diagnostics).

## Purpose

The owner can inspect candidate stocks on Android during a short 09:10–09:25 break, but the archived 09:08 morning classifier has 60/60 unavailable records (50 MISSING_CANDLES, 10 UNSPECIFIED). Waiting until 09:15 may yield more completed 5-minute bars. **Do not backdate delayed data to 09:05 or assume the chart's 09:15 open could have been executed.**

The existing explicitly owner-triggered **「5分足を確認して証拠JSONを保存」** POST on \`/admin/night-morning-watch\` is reused; no new scheduled job or market-data request is added.

## What the review does

- Verify the actual server **request and receipt** are in the same 09:15/09:20/09:25/09:30 five-minute slot on an eligible JPX session.
- Use only Yahoo 5-minute *completed* 09:00, 09:05 and 09:10 bar opens/closes/volumes, each with timestamps ≤ the actual response receipt. The 09:15 candle (and anything later) cannot affect this three-bar check.
- Reject missing or malformed OHLCV, forged future bars, out-of-date records, duplicate bars, code/date mismatches and slot rollover. A 09:20 observation is explicitly labelled **09:20 receipt**, never 09:15.
- Use the existing, already captured before 09:00, \`morning_market_forward_runs\` Nasdaq Yahoo reference snapshot **only if** policy/date, source, quoteDate, sourceTimestamp and capture timestamp are correct. A Nasdaq decline of -3% or below triggers a \`PAUSE_MARKET_RISK\` research label even if the candidate looks strong.
- If US evidence is missing or stale: \`WAIT_FOR_MARKET_DATA\`. If completed bars are missing: \`WAIT_FOR_BAR_DATA\`. If reference cost of 100 shares exceeds ¥380,000: \`OVER_BUDGET_REFERENCE\`.
- If the price gap is extreme or three-bar trend/volume are not confirmed, keep \`CAUTION_*\`. A rising, volume-observed pattern becomes \`TREND_WATCH_ONLY\`, **not BUY**. The criteria are uncalibrated heuristics, **not validated for trading performance**.
- Display these statuses next to the existing Android owner-only manual JSON download. The original SHA-256-signed-by-hash-only JSON evidence archive remains unchanged. Response-derived labels are not broker quotes or signed attestations.
- \`eligibleForTrading=false\`, \`eligibleForNotifications=false\`, \`eligibleForAiPower=false\` for every output. The Japanese TOPIX/Nikkei values are not reliably present in morning storage, so a non-shock Nasdaq value never proves Japanese equity safety.

## Verification

\`node --test tests/morning0915Review.test.mjs\`

The existing \`night-morning-watch-ci.yml\` also runs its prior test suites, \`npm ci\`, Next typegen and \`tsc --noEmit\`. No DB mutation, broker API, background polling, cron changes, new providers or paid subscriptions.

## Next evidence requirement

Capture **prospective**, owner-triggered early-morning provider response evidence on at least ten actual trading days. Compare the 09:15 available coverage vs the separate 09:08 archive; compare 09:20 if needed. Do not infer the quality of the strategy from synthetic tests. A strategy release needs official/licensed as-of market data, actual executable quotes, stop/gap modeling, frozen candidates, +1/+3/+5 sessions, out-of-sample performance, market regime diversification and human approval.

IMPORTANT: Even if the interface visually shows \`TREND_WATCH_ONLY\`, it is **not** an instruction to buy or a high win probability.
