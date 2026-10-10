# Different-day shadow price sampling (research-only)

## Existing evidence

On 2026-10-10, production `daily_stock_results` has complete recorded prices (953 or 955 stocks per day) for 2026-09-30 and 2026-10-01,02,05,06,07,08,09, among other historical sessions. The reference comparison table contains **15 rows for 2026-10-09 only**, so there is no observed day-to-day trend yet.

## Phase 4: make different saved trading days easy to study

- Existing page `/admin/daily-price-reference` shows up to eight **recent complete trading days**, including each source count and already compared symbol count.
- Tap 10/08, 10/07, 10/06, etc. to **select that day** and fill up to five diverse stock codes from its own saved baseline data. Existing 10/09 records are not reused for these dates. The familiar "latest trading day" button remains.
- Dates/candidates come from the *existing PostgreSQL tables only*. The buttons make no Yahoo calls and do not write observations.
- The separate blue "Yahoo日足と照合して別保存する" button still requires a deliberate admin tap. It is **not automatically activated**; comply with the provider's data access/storage/commercial-use permissions before relying on the manual workflow outside the current research trial.
- A newly recorded price comparison is appended to the private independent research table and does **not** retroactively change the AI learning snapshot, historical wins/losses, trading decisions, notification schedule or simulation positions.
- The existing trend page `/admin/price-reference-trend` will then display comparisons across multiple **trade dates** without any change.

## Production safety and validation

- Last saved trading day excludes today; candidate source must have 800–1,300 records and fall within prior 90 days.
- Correctly compares `daily_stock_results.date` as ISO TEXT and casts it only when joining to `trade_date DATE` in the shadow table. Production read-only query was tested against last eight dates and showed 10/09 has 15 compared symbols; all other recent dates have 0.
- Sampling remains deterministic and stratified by stored baseline price. This is *not an unbiased market sample*. No model uses the collection automatically.
- No new DB migration, cron, external market-data calls, bot, recurring reminders, live trading signal changes or writes from this PR.
- To see a trend, capture several complete days and ideally evaluate more dates and securities. Avoid treating tiny samples or Yahoo's reference data as definitive close-price errors.
