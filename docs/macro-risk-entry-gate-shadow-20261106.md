# Market shock and 3–5-session risk gate — SHADOW V1 (2026-11-06)

## Why this exists

The owner reported a broad Japanese equity sell-off alongside several short-term holdings declining on 2026-11-06. The event motivates risk research; it does not prove that the gate would have prevented prior losses. Do not publish owner brokerage balances or private positions.

## What changed

- app/lib/research/macroRiskEntryGate.mjs is a pure offline macro risk and pre-entry planning assessor.
- tests/macroRiskEntryGate.test.mjs covers fifteen synthetic safety cases.
- scripts/research/evaluate-macro-risk-plan.mjs reads a frozen, manually captured JSON file and prints an audit result without network calls or writes.

## Predeclared, unvalidated pause rules

A shadow recommendation to pause new buys is raised when:

- Nikkei 225 or TOPIX declines at least 3%; OR both decline at least 1.5% using the same session and quote status.
- Nasdaq Composite declines at least 3%, S&P 500 at least 2.5%, or SOX at least 5%.

These thresholds are **conservative review hypotheses, not calibrated predictions or proven risk filters**. A US shock may trigger caution even if current Japan data is missing. A non-trigger must never be interpreted as an instruction to buy.

## Evidence constraints

Each market observation must contain index key, signed returnPct, market-local sessionDate, capturedAt with time-zone offset, quoteStatus (CLOSED or INTRADAY), and HTTPS sourceUrl. The overall asOf must include an offset. No future captured observation, missing-source observation, duplicate index, or quote older than 96 hours can be counted. Duplicates quarantine the index rather than allowing a favorable record to win. Absence of reliable Japanese and overseas observations yields INSUFFICIENT_MARKET_EVIDENCE rather than approval.

96 hours is a provisional maximum data age allowing weekend gaps, NOT evidence that the latest required exchange session is present. HTTPS source claims and timestamps are not independently authenticated. Actual licenses, calendars, official closes, freshness, data availability at 09:05 and executable fills still require verification.

Compare stock vs TOPIX only when sessionDate and quoteStatus match. Stock return minus TOPIX return of -2 percentage points or less raises STOCK_UNDERPERFORMING_MARKET; when TOPIX is down at least 2% and stock excess is -1 percentage point or better, label BROAD_SELL_OFF_ALIGNED. These labels describe relative performance only. Neither establishes political, macroeconomic, sector-specific or company-specific causation.

## Three-to-five-session plan

A proposed short-swing plan must explicitly state positive entry, lower stop, higher target, integer share count and 3–5 *trading sessions*. Risk in yen equals (entry-stop)*shares; target reward is (target-entry)*shares. Planned losses greater than ¥10,000 and reward/risk below 1.5 require review. A stop order can gap, slip or fail: ¥10,000 is NOT a guaranteed loss cap. Reaching the review horizon is never permission to silently convert a short-term idea to an indefinite holding.

## Manual run and safety boundary

Run the synthetic test with:

    node --test tests/macroRiskEntryGate.test.mjs

Run a locally captured evidence file with:

    node scripts/research/evaluate-macro-risk-plan.mjs /path/to/asof-evidence.json

Illustrative JSON format, with fictional prices and sources (NOT a verified historical quote):

    {
      "asOf":"2026-11-06T09:15:00+09:00",
      "observations":[
        {"key":"NIKKEI","returnPct":-2,"sessionDate":"2026-11-06","capturedAt":"2026-11-06T09:10:00+09:00","quoteStatus":"INTRADAY","sourceUrl":"https://example.org/index"},
        {"key":"TOPIX","returnPct":-2,"sessionDate":"2026-11-06","capturedAt":"2026-11-06T09:10:00+09:00","quoteStatus":"INTRADAY","sourceUrl":"https://example.org/index"}
      ],
      "stock":{"code":"3762","returnPct":-3,"sessionDate":"2026-11-06","capturedAt":"2026-11-06T09:11:00+09:00","quoteStatus":"INTRADAY","sourceUrl":"https://example.org/stock"},
      "tradePlan":{"entryPrice":3100,"stopPrice":3050,"targetPrice":3200,"shares":100,"holdingSessions":3}
    }

Release restrictions: eligibleForTrading, eligibleForNotifications and eligibleForAiPower are all hardcoded false. No changes to orders, existing alerts, owner push, rank/scoring, cron, production site, database, or account. A separate independent replay and prospective validation across different market regimes, data outages, delayed feeds, slippage, false halts, crisis gaps and actual position exposure is required before a human-approved production release.
