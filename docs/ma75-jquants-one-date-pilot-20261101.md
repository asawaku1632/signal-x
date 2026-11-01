# One-date J-Quants daily research pilot (Draft PR #297)

Safe default: no network requests, no API-key reads, no output file, no database or application changes.

Dry-run command:

    node scripts/research/ma75-jquants-one-date-capture.mjs --date=2026-10-30 --output=./research-private/2026-10-30-original.json

Only if your existing J-Quants access covers historical daily OHLCV, configure JQUANTS_API_KEY and SIGNALX_RESEARCH_ALLOW_JQUANTS_READONLY=YES privately, and add the --execute option. Never paste credentials into GitHub or ChatGPT. The CLI does not change subscriptions or initiate billing. No requests are sent automatically by this PR.

The optional run requests exactly ONE historical date for ALL listed stock codes, with no code filter, at most 12 pages, and no 429 retry. All original page responses are retained in a local exclusive-created JSON file with mode 0600, only after all pages are complete and pass original-code/date checks. Keep that licensed raw file outside Git tracking.

The original raw one-day capture may later be inserted into an offline 76-session bundle via its pages array, alongside a separately obtained complete TSE calendar. See docs/ma75-original-daily-bundle-guide-20261101.md.

Official daily API: https://jpx-jquants.com/ja/spec/eq-bars-daily
Official rate limits: https://jpx-jquants.com/ja/spec/rate-limits

All tests use synthetic responses and mocked fetch; actual API entitlement, real stock prices, original capture authenticity, 76-session coverage, and profitable returns have NOT been verified. No live signal is enabled.
