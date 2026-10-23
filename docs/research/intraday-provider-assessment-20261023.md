# Intraday provider assessment — 2026-10-23

Research-only findings, based on public JPX/J-Quants documentation. No subscription or API calls performed.

| Candidate | Intraday granularity | Delivery | Access/cost | Current gate |
|---|---|---|---|---|
| J-Quants API Free | No minute bars | Daily OHLC delayed 12 weeks | ¥0 | BLOCKED: INTRADAY_DATA_UNAVAILABLE |
| J-Quants API Light + minute/tick add-on | Minute bars | Daily batch, not live | ¥1,650/month + ¥5,500/month = ¥7,150/month incl. tax | BLOCKED: COST_APPROVAL_REQUIRED; commercial-use permission needs separate review |
| J-Quants Pro | 1-minute OHLCV | Confirm product agreement | Corporate product; price and license not established here | BLOCKED: PROVIDER_APPROVAL_REQUIRED |

Official sources:
- https://www.jpx.co.jp/corporate/news/news-releases/6020/20260119.html
- https://jpx-jquants.com/ja/help/data
- https://jpx-jquants.com/ja/help/plan
- https://jpx-jquants.com/ja?lang=ja
- https://www.jpx.co.jp/corporate/news/news-releases/6020/20260928-01.html
- https://www.jpx.co.jp/term-of-use/

## Decision
Do not activate intraday collection, schedule a cron, or purchase data. Individual J-Quants terms and rights to ingest data into a commercial SIGNALX service are not established. Daily batch minute data could support **after-the-fact research**, but cannot generate a same-day 14:10 decision signal. Real-time intraday signal generation requires a separately approved timely feed.

## Next engineering work once approved
1. Verify contract rights, plan, cost and access using metadata only; never print API keys.
2. Validate real sample timestamps and coverage for 3762, 9684, 6088, plus representative 950-name universe.
3. Ingest into isolated shadow tables, idempotently keyed by provider/security/trading-date/bar timestamp.
4. Keep replay/backtests separate from real-time alerts, trading, and paid-user surfaces.
