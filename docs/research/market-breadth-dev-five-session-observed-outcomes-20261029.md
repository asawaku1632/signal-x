# DEV BB 5-session observed outcomes — read-only inspection, 2026-10-29

Source: DEV Supabase project `jdtqwryiyxeuoraecorw`, tables `technical_bb_observation_snapshots`, `technical_bb_observation_events`, `technical_bb_observation_results`. SELECT-only join on snapshot/event/result, filtering `horizon=5`. Production project was not queried.

| Observation date | Code | Event variants | 5-session return | Evaluated trade date |
| --- | --- | --- | ---: | --- |
| 2026-08-21 | 8591 | LOWER RETURN_INSIDE, LOWER TOUCH | +1.6843826655764516% | 2026-08-28 |
| 2026-08-21 | 9432 | UPPER TOUCH | +1.5051173438500467% | 2026-08-28 |
| 2026-08-21 | 9983 | LOWER CROSS, LOWER TOUCH | -3.0608080533260784% | 2026-08-28 |
| 2026-08-28 | 9983 | LOWER TOUCH | -3.031153522312658% | 2026-09-04 |

Six result rows represent only four independent stock/date observations across two dates. All six have `horizon_unit='TRADING_DAY'` and `result_quality='COMPLETE'`. All six snapshots have `created_at <= bar_end_at` **false**, so they were saved after the observed bar ended. This is not proof of a frozen contemporaneous prospective prediction.

Simple descriptive results: 2 positive, 2 negative, mean = approximately -0.7256%, but **not** a strategy estimate: selection, timing, costs, rights, independent provider attestation, and market regime are not established. Do not feed these rows into automatic weights, trading alerts or claims of model improvement.

Next: inspect actual prospective signal-generation timestamps and independent price provenance; expand observation dates materially; compare frozen candidate vs baseline on held-out dates with transaction costs and leave-one-date-out sensitivity. Legacy `daily_stock_results` lives in separate PostgreSQL via `DATABASE_URL`, which was not accessed.
