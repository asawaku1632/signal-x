# Dual-surge market-data licensing gate (2026-10-24)

Status: BLOCKED for live prospective collection until written source authorization is verified. This is a research-branch decision record, not an enabled job.

## Verified primary sources
- J-Quants API terms, Article 8: personal/private use only; commercial use and making data or transformed data available to third parties are not private use: https://jpx-jquants.com/ja/termsofservice?lang=ja
- J-Quants FAQ: Free data is delayed 12 weeks; repeated provision of investment analysis to third parties is prohibited: https://jpx-jquants.com/apidoc.html
- JPX market-data licensing: redistribution may require JPX permission / an IPLA: https://www.jpx.co.jp/english/markets/paid-info-equities/realtime/02.html
- J-Quants Pro: some datasets allow external distribution, subject to dataset-specific terms: https://jpx.gitbook.io/j-quants-pro/faq/use

## Required before enabling any data ingestion
1. Identify actual provider, plan, endpoint, data delay, allowed storage, allowed internal analysis, and whether publication of derived signals/results is licensed.
2. Obtain written approval or applicable contractual terms for SIGNALX's intended audience and research/public use.
3. Independently verify completed-session timestamps, calendar, OHLCV adjustment/split handling, and data source integrity.
4. Test a tiny prospective cohort only on isolated dev infrastructure with no backfill, no production database, no rankings, alerts, or trading.
5. Keep the live collection Cron disabled until all gates are evidenced; never set licenseStatus='APPROVED' merely because an API key works.

Current state: no live collector enabled, no provider approved for this workflow, no claim of live data acquisition.

## Owner decision — 2026-10-24
The owner explicitly chose **personal research only**. Keep dual-surge signals, source OHLCV, observations and outcome metrics in owner-only research surfaces. Do not expose to subscribers, public pages, APIs, notifications, rankings, shared exports or trading automation. Restrict access at server/API and database layers; hiding UI links alone is insufficient.

This scope reduces redistribution risk but does not itself establish provider license compliance. Validate personal-use terms, permitted automated fetching, storage/retention, and whether analysis within the SIGNALX infrastructure remains within private use. The live ingestion gate stays CLOSED until the actual source and rights are verified.
