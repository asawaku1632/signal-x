# TOPIX provider assessment (2026-10-21)

## Verified Yahoo chart probe
GitHub Actions read-only network test:
- `998405.T`, `^TOPX`, `^TOPIX`, `^TPX` all returned HTTP 404 from query1.finance.yahoo.com chart API.
- Do **not** infer that Yahoo Japan's published `998405.T` web page implies Yahoo US chart API support.
- `fetchTimestampedMarketIndex("topix")` now returns `missing` without a network call (fail closed).

## Official alternatives
- JPX J-Quants API v2 documents `GET /v2/indices/bars/daily/topix` for daily TOPIX OHLC. This is **daily**, not 09:05 intraday; the API documentation does not provide an exact availability timestamp per data item. Check subscription and commercial-use rights before integrating.
- JPX's paid historical market data offering documents real-time TOPIX historical information, with access restrictions, and must not be treated as an available free live intraday API.

## Research design
- Split into independent **intraday benchmark** (must include source timestamp and matching session) and **daily benchmark** (date-only, never label as 09:05).
- Do not substitute ETF prices or Nikkei for TOPIX without explicit separate benchmark labels.
- Before any automated saving: verify permitted redistribution/derived-use rights, data timing, identity, dev DB routing, and independent cross-check.
- No production migration, no cron, no notifications, no scoring changes.

References:
- https://jpx-jquants.com/en/spec/idx-bars-daily-topix
- https://www.jpx.co.jp/english/markets/paid-info-equities/historical/01.html
- https://finance.yahoo.co.jp/quote/998405.T
