# SIGNALX market-data permission decision register — 2026-10-28

Research-only planning note. No paid subscription, data retrieval, production activation, or legal authorization is implied.

## Official sources

- Personal J-Quants API FAQ: https://jpx-jquants.com/apidoc.html — prohibits recurring delivery of investment analyses based on API data to third parties; publishing methods in isolation is distinct.
- J-Quants API terms: https://jpx-jquants.com/ja/termsofservice?lang=ja — contractual terms control.
- J-Quants Pro purpose-of-use FAQ: https://jpx.gitbook.io/j-quants-pro/faq/use — primarily corporate internal use; external delivery only for certain datasets, subject to pricing/use terms.
- JPX J-Quants Pro: https://www.jpx.co.jp/markets/other-data-services/j-quants-pro/ — corporate-facing product.
- JPX data announcement: https://www.jpx.co.jp/corporate/news/news-releases/6020/20260928-01.html — 1-minute bar data available via Pro; not evidence of a live quote feed or SIGNALX redistribution rights.

## Separate requested permissions (do not infer one from another)

1. Personal historical research, retention in isolated development PostgreSQL, and automated feature extraction.
2. Time-of-observation as-of research capture, refresh cadence, retention and permitted instruments/timeframes.
3. Commercial processing into AI POWER rankings, derived predictions and risk thresholds.
4. Persistent or repeated third-party delivery of scores, alerts, commentary and derived analytics; user count and pricing tier.
5. Any display or forwarding of underlying OHLCV/quote values and required attribution.
6. Recordkeeping and audit requirements; licensing after subscription termination.
7. Fees, trials and usage limits, without placing any order.

## Current status

- License grant for developer research capture: NOT ESTABLISHED.
- License grant for production derived-signal notifications: NOT ESTABLISHED.
- Independent as-of live observation series: NOT COLLECTED.
- Operational decision: KEEP CAPTURE DISABLED; NEVER set SIGNALX_RESEARCH_PROVIDER_PERMISSION_CONFIRMED merely because a provider is named.
- Activation requires explicit provider agreement / authoritative written permission matched to exact use, and separate engineering review.
- No production deployment, notification, AI threshold change or DB writes authorized by this document.

## Ready-to-send provider inquiry (not sent)

SIGNALX is a Japanese-equity analysis application that may retain source OHLCV observations in a private research database, compute derived AI POWER ratings, evaluate forward 5-session outcomes, and potentially deliver recurring scores and alerts to paying third-party users. Please confirm separately whether (a) local research retention and automated analysis, (b) derived-score commercial distribution, (c) repeated end-user alert delivery, and (d) any underlying price display are allowed for the specific dataset and plan. Please also specify delay, covered stocks, rate limits, retention, redistribution/derived-data fees, attribution, contractual eligibility, and written terms. No agreement or purchase is requested by this inquiry.
