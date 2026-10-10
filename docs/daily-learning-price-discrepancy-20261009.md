# 2026-10-09 / 9984: learning snapshot versus later 1D price

## Read-only production findings (observed on 2026-10-10 JST)

| Record | Trade date | Price | Observed / recorded |
| --- | --- | ---: | --- |
| public.daily_stock_results | 2026-10-09 | 5,838 | 2026-10-09 15:35:35 JST |
| public.swing_universe_observations | 2026-10-09 | 5,838 | 2026-10-09 16:20 JST |
| display_snapshots: scan:stock:9984 | 2026-10-09 latest bar | 5,803 | 2026-10-10 05:12 JST |
| display_snapshots: chart:9984:1D | 2026-10-09 | 5,803 | 2026-10-10 05:12 JST |
| display_snapshots: scan:latest | 2026-10-09 latest bar | 5,803 | 2026-10-10 05:13 JST |

The daily learning save was logged as SAVE_SUCCESS (953 symbols) at 2026-10-09 15:35:36 JST. It obtained stocks from /api/scan?limit=1000; the captured response said cached=true.

**Verified mechanism:** save-daily takes an earlier scan snapshot's price field and persists it using saveDailyStocks, which inserts once (ON CONFLICT DO NOTHING). The chart route independently retrieves Yahoo intraday or daily bars. Both the later 1D bar and later stock snapshot show 5,803. Thus the stored learning price and chart/stock display have different "as of" times.

**Not verified:** whether Yahoo revised the close after 15:35, whether the cached scan had pre-closing values, or whether another upstream inconsistency occurred. The older scan payload was overwritten in display_snapshots, and 9984 has no matching provenance row for this date. The earlier intraday bar history is insufficient to distinguish those causes.

## Safety-preserving next step in this PR

Provide an **admin-only, on-demand, read-only** comparison tool:
- Compare one dated daily_stock_results row against the Yahoo 1D bar for that exact JST trading date.
- Report match/mismatch with yen and percent difference; show pending/unverified when the bar cannot be considered final/located.
- Do not replace historic prices, recompute learning metrics, alter signals, execute cron, or send notifications.
- A 1D price may still be revised/adjusted by data vendors (e.g. splits); flag discrepancies as audit findings rather than declaring the reference infallible.

## Later decision (separate review required)

If repeated differences are verified across symbols/dates, propose a versioned post-market-close verification/backfill process with *recorded provenance and explicit isolation from live trading*. Do not silently rewrite any prior outcomes or study results.
