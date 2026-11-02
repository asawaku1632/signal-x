# 2026-11-02 — Read-only signal-x database evidence audit

> This is a 2026-11-02 owner-development assessment, not an ongoing
> correctness guarantee. All evidence comes from read-only SQL on the
> connected Supabase projects. No migration, user-facing ranking, scheduled
> task, paid data contract, or production data mutation was performed.

## Project separation
- Connected Supabase project named `signal-x` (`paygtakajhvatwejygda`)
  has `daily_stock_results`, `morning_final_check_runs`,
  `entry_time_shadow_runs`, and `swing_universe_observations`.
- Connected project named `signal-x-dev` (`jdtqwryiyxeuoraecorw`)
  has `entry_time_shadow_runs` and `swing_universe_observations`,
  but did not expose either of the daily or frozen-morning tables.
- **This does not prove which project's connection string the deployed
  Vercel `DATABASE_URL` resolves to.** Do not read or publish the secret.
  Confirm target through a safe operator-approved runtime diagnostic before
  applying the proposed migration.

## Daily AI snapshots
- `daily_stock_results`: 74,148 stock-day rows, 967 distinct symbols,
  79 dates (2026-06-29 through 2026-11-02).
- Latest five sessions inspected (Oct 27–30 and Nov 2) each have 953
  unique stock rows, no duplicate code/date rows, no null/zero price,
  and no missing AI score.
- On 2026-11-02, 47 of 953 entries have AI POWER >=85.
- Three valid JPX alphanumeric symbols **590A, 641A and 642A** were excluded
  by legacy `^[0-9]{4}$` rules. Fixed the *new* budget-universe research
  parser with the official JPX SICC code-position rule; the original
  independently versioned top-five study was not retroactively changed.
- The `created_at` column is `timestamp without time zone`, while the
  queried database session uses timezone `UTC`. The rows saved at
  `2026-11-02 06:35:38.646585` are consistent with a 15:35 JST daily
  capture, but their semantics must be validated with the writer.
  The new read-only runner explicitly interprets `created_at AT TIME
  ZONE 'UTC'`, avoiding server-locale-dependent parsing. The new
  capture feature remains disabled by default.

## Frozen morning study is currently data-blocked
- `morning_final_check_runs`: 9 target dates Oct 21–Nov 2, 5 codes per
  date, 45 actual saved morning observations. All 9 runs are `PARTIAL`.
- Of those **45/45 records, every saved label was `UNAVAILABLE`**:
  35 had `quoteReason='MISSING_CANDLES'` and 10 had a null quote reason.
  Thus there are **zero observed BUY_CANDIDATE, CAUTION or SKIP labels**,
  and there is no statistical evidence that the 09:05 rule is profitable.
  It would be inaccurate to interpret missing data as losses, skipped buys,
  failed predictions or valid trades.
- The current runner requests Yahoo `range=1d&interval=5m` around 09:08
  and requires the first 09:00 five-minute candle and the 09:05 OPEN.
  The evidence is consistent with absent/unready upstream bars at the
  collection time, but the true root cause requires observed feed timestamps,
  response error auditing and provider-lag measurements; do not presume
  an exact delay or call count until measured.
- New owner-side `morningCaptureHealth` diagnostic shows totals and
  reason frequencies without rewriting historical rows. No cron schedule
  or timing policy was silently changed. Before alerts, experiment with
  completed 5m bars and a **new**, explicitly versioned capture policy and
  enough forward observations; never backdate old decisions.

## Separate 1/3/5-day study
- `entry_time_shadow_runs`: 13 runs through 2026-10-30,
  6 COMPLETE and 7 PARTIAL in this snapshot.
- A frozen 09:05 decision captured around 09:08 cannot retroactively
  buy at 09:05. The budget-forward research uses a later 09:30 five-minute
  indicative OPEN for entry. It is still not broker-fill proof.
- Sample thresholds and no-lookahead checks remain required; no observed
  win rate was manufactured from incomplete evidence.

## Remaining release gates
1. Read-only inspect actual Vercel project's database identity without
   exposing DATABASE_URL, then validate a nonproduction schema and privileges.
2. Measure 5m feed arrival and content timestamps at 09:08/09:10/09:15
   on future trading sessions before selecting any new study cutoff.
3. Validate the full stored universe count against the intended scan
   universe, including JPX letter codes, split adjustments and timestamps.
4. Collect forward 1/3/5-session results in a new immutable cohort and
   compare to nonselected baselines with trade-count, day and regime coverage.
5. Keep all three switches off pending the owner's explicit approval:
   migrations, budget freeze writes, licensed TDnet HTTP calls.
