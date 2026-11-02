# Next-session budget watch — 2026-11-02 (owner-only shadow)

## Motivation
A concrete stock shortlist must answer **which symbol, when, why, how much, and what invalidates it**.
It must not claim an unverified next-day rise simply because an AI score is high.
A Gemini screenshot supplied by the owner is a design benchmark, not a training label or evidence that Gemini was correct.

## Delivered in this draft PR
- Adds 100-share shortlists by reference-cost caps of JPY 100,000 / 300,000 / 350,000 / 500,000.
- Source: completed-session `daily_stock_results` selected by existing JPX-aware `nightMorningTradingDates`; stock-day mismatches, missing prices, and contradictory duplicates are excluded.
- Uses stored AI POWER as **a deterministic reference sort only**. Outcome data, unverified earnings claims, and future information cannot influence the sort.
- Displays reference price, 100-share total, and the *required* per-share rise / percent for a pre-tax JPY 7,000 target. This is arithmetic, **not an expected return**.
- Makes material/volume confirmation explicitly unavailable and entry contingent on post-09:05 recheck; no order, alert, public rank, cron or production rule is changed.
- Lists incomplete universe coverage if the source query hits its 1,500-row cap.
- Preserves owner-only access on `/admin/night-morning-watch`.
- Reuses the existing 2026-2027 JPX holiday calendar; 2026-11-03 is a cash-market holiday, and the following trading session is 2026-11-04.

## What is NOT delivered
- No confirmed `2026-11-04` predicted winners.
- No trustworthy, timestamped catalyst extraction, IR filing checks, volume-20-day averages, bid-ask liquidity, or intra-day tradable fills.
- No independent performance calibration, prospective 1/3/5 day hit rates, cost-adjusted edge, or drawdown validation.
- No production deployment, automatic notifications, user-facing buy indication, or automatic trading.
- This PR does **not** prove that top AI scores outperform other selection rules.

## Data connection limitation
The current application reads `daily_stock_results` via the `DATABASE_URL` PostgreSQL pool.
The connected `signal-x-dev` Supabase project checked on 2026-11-02 does not expose a `daily_stock_results` table and currently has zero `swing_universe_observations`. This does not imply that the application's separate PostgreSQL historical archive has been lost or is useless.
Access to the actual `DATABASE_URL` archive and row-level observation timestamps is required for live coverage and replay verification.

## Verification / acceptance gates for a genuine candidate ranking
1. Freeze a candidate cohort **before** the evaluation session. Save session date, observation timestamp, source, version, budget and reason codes.
2. Confirm real JPX trading day and latest session (never treat a holiday as a next-day trading session).
3. Check verified company IR / upward revisions, sector breadth, 20-session volume baseline, liquidity and imminent events **as of the freeze time**. Unknown is not false or positive.
4. Use the `09:05` completed first 5-minute bar and fresh compatible AI snapshot; no early/missing data means **WAIT** not buy.
5. Audit real entry feasibility, slippage, costs, gaps, maximum adverse excursion, and the owner's JPY 10,000 loss tolerance. A stop does not guarantee that loss cap.
6. Compare frozen selections with independent 1-, 3-, 5-session prospective results and appropriate baselines. Report sample sizes, distinct days, median and mean, drawdown, coverage and market regimes; no success rate with insufficient observations.
7. Stage notification release only after reproducibility and owner approval. Keep the owner-only shadow isolated from the normal trading/ranking workflow.

## Run tests
```sh
node --test scripts/research/next-session-budget-watch.test.mjs
```
The scenario prices in tests are fictional test fixtures taken from screenshot examples, not verified market quotes.

## Stage-2 addition (2026-11-02)
- `nextSessionCatalystAudit.mjs`: a timestamp-eligible catalyst metadata record is accepted **only** when the issuer code, event type, HTTPS source, title, official release timestamp and observation timestamp exist and were known before the stored cohort freeze. Post-freeze IR is *not* a valid prior-night edge. This is a timestamp check only, not independent verification of filing text or issuer identity. The intake has no active IR retrieval connector, so UI truthfully reports **NOT_VERIFIED**.
- `assessFrozenBudgetMorning`: exact pair-match with `morning_final_check_runs` using trade date, prior date, actual `frozen_at`, same candidate score/price, morning saved timestamp, and original 09:05 label/price. At 09:05, 100-share cost may exceed the prior-night budget; this is `OVER_BUDGET`, not a promising candidate. Only an actually saved night-cohort member is labelled verified, never post-selected from winners.
- `nextSessionBudgetForward.mjs`: compares `buildNightHoldingStudy` observations for 100-share candidate costs under 10/30/35/50万円 budgets and frozen 09:05 BUY_CANDIDATE. Only actual saved 1/3/5 trading-date reference snapshots, strictly matured before as-of day, count. Reports sample sizes and missing prices. Means/medians/positive and +7,000円 hit rates stay hidden until **30 stock-days and 10 distinct trade sessions** per horizon.
- Added owner-only cards to `/admin/night-morning-watch` and `/admin/night-entry-holding` using the existing research archive and no DB write. The frozen top-five subset is **not** the full stock-universe budget winner ranking.
- No new paid data feed, no cron, no DB migration and no public investor recommendation. The existing pseudo-profit issue is separately addressed in Draft PR #300; this PR does not bypass its fillability requirements.
- `npm run test:next-session` runs the original 7 tests plus 18 additional as-of/evidence/forward checks; Vercel preview build is gated on the suite.

### Evidence still missing
1. No official IR/TDnet ingestion, verified observation timestamps, or company-event coverage statistics. Price jumps alone never prove an earlier disclosed material.
2. `morning_final_check_runs` only froze up to five highest-score candidates; current budget shortlist may contain additional symbols. Those must show `NOT_FROZEN`, and are ineligible for causal performance claims.
3. Quotes are stored Yahoo 5-minute **reference opening prices**, not actual executable bid/ask fills; future comparison uses archived daily scan price, not official split-adjusted total return. Slippage, fees, corporate actions, market regime and liquidity remain unverified.
4. Existing scores alone have not demonstrated out-of-sample edge. Do not promote this data to production ranking, notifications or trading decisions.

### Look-ahead correction
- A 09:05 classification is usually saved around 09:08. **Buying at 09:05 based on that decision is impossible**. The forward summary now uses an independently archived **09:30 bar OPEN** for indicative 100-share entry, with the original saved 09:05 classification as a precondition.
- Both the prior-night reference cost and the later 09:30 reference cost must be within the selected budget. Missing 09:30 anchors are excluded, not fabricated; caution/skip is not zero P&L.
- Remaining uncertainty: a Yahoo 09:30 five-minute OPEN is not evidence that 100 shares were actually available to fill at that price. It is strictly a research reference, not tradable ROI.
