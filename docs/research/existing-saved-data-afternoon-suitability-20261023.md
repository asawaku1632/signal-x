# Existing saved data suitability for owner-only afternoon research — 2026-10-23

Read-only code audit. No DB access, no Yahoo quote calls, no data export, no production changes.

## Confirmed
- `app/lib/displaySnapshot.ts` stores a **latest-value upsert** keyed by `snapshot_key` in `display_snapshots`. `scan:latest` and `scan:stock:{code}` are refreshed/replaced. These snapshots are not an append-only, historical intraday candle archive.
- `app/lib/scanSnapshot.ts` saves public scan result payloads and timestamp `updatedAt`. Per-stock payload may contain `latestBarTimestamp` but does not establish retention of every 5m OHLCV bar.
- `app/lib/learning/stockAnalyzer.ts` fetches Yahoo `range=1d&interval=5m` and `range=3mo&interval=1d` to analyze. Its transient `candles` array is not proof of persisted minute bars.
- `app/lib/research/approvedAfternoonPair.mjs` correctly declines to infer a post-decision high from two observed prices.
- Other forward-study tables may exist, but their actual contents, completeness, licensing and 14:10 time validity have not been checked. No live database query was performed.

## Assessment
Existing **scan snapshots alone are insufficient** to establish 14:10-to-close limit-touch rate or morning spike/fade timing. Some point-in-time study records may be usable for narrow research only after checking schema, exact timestamps, provenance, rights, and availability of independent post-decision extrema. Do not reconstruct historical point-in-time observations from end-of-day highs.

## Permission gate
Owner-only UI does not grant a blanket exception to Yahoo automated collection or reuse restrictions. Yahoo terms require prior permission for automated collection; Japan Yahoo Finance prohibits automated extraction of its published financial data. Exact Yahoo US endpoint and applicable rights need independent legal/provider review.

## Safe next step
Inspect migration definitions and data-shape contracts of existing forward-study tables; optionally run metadata-only read-only queries after confirming permitted scope, but do not access or reprocess third-party raw market data without rights review. Any findings should be counts/schema only, not raw prices.

Official sources:
- https://legal.yahoo.com/us/en/yahoo/terms/otos/index.html
- https://support.yahoo-net.jp/SccFinance/s/article/H000011276
