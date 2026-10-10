# Price Reference Sampling Phase 3: local-only daily candidates

## What changes

- On the existing administrator page `/admin/daily-price-reference`, one button chooses up to five candidates from the **latest previous trading day's recorded daily_stock_results** and fills the date and code input fields.
- GET `/api/admin/daily-price-sample`: admin session required; read-only PostgreSQL access, maximum 1,301 source rows fetched; refuses source snapshots below 800 or over 1,300 rows, outside 90 days or same-day/future target.
- Exclude securities already in `daily_learning_price_reference_audits` for the chosen trading day, so selecting again does not preferentially re-audit the same symbols.
- Selection deterministic by saved trade date, 32-bit hash and original **baseline price strata** (below 1,000, 1,000–2,999, 3,000–9,999, 10,000+ yen), rotating first stratum and preferring sector diversity within each stratum.
- Baseline data only: do not see or rank using subsequent reference prices, results, intraday reactions, AI POWER, or recommendations. This is not a perfectly random or representative sample; stratification and manual completion can produce selection bias.
- Candidate button does **not** access Yahoo, run scan, set cron, save, notify or recalculate model performance. The existing manual reference-save action is left unchanged, including its bound of up to five symbols.

## Market-data rights gate

Yahoo's official terms discourage/prohibit unauthorized automated collection; some Yahoo services limit commercial use. The undocumented finance chart endpoint does **not** confer rights to commercial reselling or automatic collection merely because it is technically accessible.

- Yahoo Terms of Service: https://legal.yahoo.com/us/en/yahoo/terms/otos/index.html
- Yahoo Developer Network Guidelines: https://legal.yahoo.com/us/en/yahoo/guidelines/ydn/index.html
- Research/manual use remains subject to provider terms; verify licensing before commercial distribution or fully automatic data collection.
- No scheduled Yahoo access is authorized by this PR. Before implementing automated quote fetching, choose a licensed vendor or secure express written permission; verify per-call charges, rate limits, permitted retention/display and storage.

## Operational limits

- No migration, no new cron, no new Vercel project, and no new credentials.
- Admin-only and no-cache; no external provider call while suggesting candidates.
- Exact date defaults to `MAX(date)` strictly before current Japan date, so a holiday/weekend or data outage does not imply an incomplete current-day result.
- The page clearly distinguishes **candidate suggestion only** from the existing **manual Yahoo lookup**. Pressing the suggestion button never starts the lookup.
- Existing historical AI decisions, reference rows, model learning metrics, push alerts and trading indicators remain unchanged.

## Phase 4, intentionally not in this PR

Only after legal/data licensing clearance and controlled resource/cost testing: consider a scheduler with explicit disable switch, strict per-day caps, idempotent jobs, origin provenance and exponential backoff. Keep entirely separate from production buy/sell and notification signals.
