# 2026-11-02 SIGNALX — Morning 09:08 data integrity and budget-universe read audit

**Status:** Owner-private SHADOW diagnostics, read-only database observations. No historical records changed, no table created, no new cron, no TDnet subscription or call, no production AI / notification / trades touched.

## Database and date-specific evidence

Read-only SQL checked the connected Supabase **signal-x** project, not assumed to be the currently deployed `DATABASE_URL`. Another connected project, `signal-x-dev`, did not expose the `daily_stock_results` or `morning_final_check_runs` table. Confirm the deployment DB target before any schema activation.

- 2026-11-02 `daily_stock_results`: **953 rows / 953 distinct codes**, no duplicate codes, **950 numeric and 3 valid alphanumeric**. Scored 85–100 and positive price: **47**.
- 100-share budget caps within those 47: **10万円: 3; 30万円: 28; 35万円: 34; 50万円: 45** (overlapping counts, not disjoint groups).
- App `STOCKS` static list contains **1005 unique codes**, so 953 records represent ~94.83% of that app list, **not all Tokyo Stock Exchange listings**. `ACTIVE_STOCKS` and excluded codes may alter the actual eligible baseline; verify target-list membership separately.
- At least the 11 observed trading sessions from 10/19–11/02 each had exactly 953 daily rows and 953 distinct codes.
- For 10/30 and 11/02 the 953 rows per day were saved at ~06:35 UTC = **15:35 JST**, after the cash market close. The `created_at` column is **timestamp without time zone**. Comparison to the freeze cutoff now explicitly converts `created_at AT TIME ZONE 'UTC'`; UTC storage convention should be validated against production ingestion.
- `budget_night_shadow_runs` did not exist in either inspected Supabase project. Do **not** retroactively manufacture its original snapshots. The proposed schema remains un-applied.

## Morning observation bottleneck

Read-only comparisons of the immutable existing `morning_final_check_runs` and `entry_time_shadow_runs`:

- **9** trade dates, **45** stocks in the actual **09:08 JST** stored morning cohort.
- **0 of 45** had usable morning BUY_CANDIDATE / CAUTION / SKIP decisions. **45 of 45** were `UNAVAILABLE`.
- Of those, **35** were explicitly `MISSING_CANDLES`; **10 older records** did not have a populated `quoteReason`. Missing reason is **not** proof of a particular upstream error.
- An independent **after-close** 5-minute-bar study for the *same dates* recorded **36 of 45 complete** outcomes. This demonstrates that many reference bars were accessible later, **not** that those observations were available at 09:08.
- This points to morning data timing, Yahoo retrieval or delayed market-feed limitations requiring investigation. **No evidence yet establishes exactly which cause is dominant.** It is invalid to claim 9:05 winning probabilities on the basis of later-retrieved data.
- After-close historical prices remain useful for retrospective behavior research, but are ineligible as originally known morning buy confirmations.

## Draft PR improvements from this audit

1. Repair malformed JPX code regex in the owner-only budget query, including codes such as `590A`, `641A`, `642A`.
2. Fix accidental duplicated owner-page JSX and protect it with regression tests.
3. Make the server's UTC-naive `created_at` comparison explicit to avoid time-zone-dependent freezing.
4. Surface saved 09:08 UNAVAILABLE counts and missing-candle reasons on the owner page.
5. Add `morningLateBarAudit.mjs`: pair the same code and trade date with the independent later archive; show `lateAvailableOnly` without changing past BUY / CAUTION / SKIP or implying executable fills.
6. Prevent an invalid / duplicated late archive row from repairing earlier incomplete evidence. Add tests.
7. Keep proposed full-universe freeze disabled unless the operator explicitly approves a **separate** research-only DB migration and env switch.

## Next acceptance gates

1. Verify the exact `DATABASE_URL` backend for any proposed new table; no mutation during this audit.
2. Instrument the actual time of Yahoo response and the 5-minute candle *start* / receipt time, and distinguish **missing at 09:08** from **arrived at 09:25 or later**. Record publisher/source and latency. Do not treat a 09:30 snapshot as knowledge held at 09:05.
3. If using late-observed candles to evaluate a new trade rule, **freeze the new rule before future sessions**, and only compare simulated fills *after* the observation time (for example, a verified 10:00 reference entry after 09:30 observation). Never relabel previous mornings.
4. Require verifiable market session/cost/size, independent days, out-of-sample 1/3/5 sessions and realistic fillability before enabling any notification.
5. Maintain the zero-cost, opt-in TDnet adapter offline until subscription and licensing explicitly approved.

**Evidence boundary:** This document reports an aggregate read-only audit; real-time quote availability, live deployment configuration, and executed trading fills were not proven by the aggregate database queries.
