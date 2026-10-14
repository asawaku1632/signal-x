# BB Breakout + Volume: 20 → 100 Stocks (Stage 4, SHADOW only)

**Purpose:** Increase empirical sample count without modifying the successful initial 20-stock outcome archive (300 graded outcomes, 103 original volume factors). Read-only group stats UNION old & new; independently persist *80 new symbols*.

## Frozen universe
- Original 20 remain exactly as chosen in BB_BREAKOUT_BATCHES, including 3762.
- New 80 are the existing fixed SUPPORT_REBOUND_RESEARCH_BASKET excluding those original 20 and one explicitly preselected additional code (5253), making 100 unique four-digit codes in total.
- 16 deterministic groups of 5, batch IDs 4 through 19.
- Curated market sectors are NOT a statistically random JPX sample. This is a retrospective study with correlated stock-day events. Results must not be used to infer guaranteed profit.

## Manual owner-only expansion
- UI: /admin/bollinger-breakout-shadow, Stage 4.
- One press can run the **unfinished groups sequentially** in the open browser; a stop control halts after the current group. No background automation; no Cron.
- Each POST only processes a selected 5-symbol group, max 2 concurrent Yahoo history requests, no retries, validates each completed OHLC series and the 2026–2027 JPX trading calendar. Entire batch rejected if any symbol fails quality.
- Durable claim ledger inserted before ANY vendor request; same batch/date cannot issue repeated requests. A group completed in any prior trading date is skipped forever.
- A study can be resumed later by opening the page again; failed groups are NOT auto-retried on the same completed market date.
- For each frozen detected upper-band breakout, assess entry at **next session OPEN** and 1/3/5 session return; save only matured horizons. Signal-day completed volume divided by previous 20 sessions' average yields HIGH(>=1.3), BELOW(<1.3), UNKNOWN. This is known only *after* the signal session closes.
- Stored outcome key is (detector_version, code, signal_time, horizon). Price-source revisions for duplicates fail closed. No overwrites, no deletions.
- New batch and outcome tables are private (RLS on, no grants to anon/authenticated). Both the owner-only API and page require getLearningOwnerSession.
- Unified statistics use **UNION ALL** of original frozen results, the original validated volume factors, and the new fully separate expansion outcomes. No legacy result migration. Display group win rates/averages only when 30+ completed observations per exact subgroup/horizon.
- Stage 4 uses **one fetch pass** per new group to calculate both BB signals and historical volume factors, avoiding the previous Stage 2 + Stage 3 redundant downloads.

## Exclusions and limitations
- No automatic 100-symbol fetching without an actual owner button press and open browser session.
- No changes to production ranking, AI POWER, trade signals, recommendations, notifications, Cron, futures lab, Phase7 DEV or existing archived records.
- No intraday 09:05 vs 11:00 backtest, because original 103 events lack timestamp-matched entry prices.
- No historical AI score backfill unless its as-of availability is independently verified and coupled to immutable signal timestamps.
- Any date outside known calendar coverage, history gaps, holidays, splits inside event window, incomplete daily bars, bad source or excessive concurrency stop saving results.
- Yahoo data may occasionally be unavailable; the run visibly stops rather than silently dropping unsuccessful stocks. The browser must remain active during the sequential process.

## Rollout gates
1. Preview builds: all Vercel targets success.
2. GitHub Actions: standalone 100-universe tests, previous BB suites and TypeScript check all success.
3. Apply only the additive migration /supabase/migrations/20261015_bb_breakout_expansion_80.sql in the production SIGNALX Supabase (not Phase7 DEV); verify RLS and no public grants. Do not run Yahoo backfill in SQL.
4. Merge reviewed PR; verify production deployment.
5. Owner opens Stage 4 and clicks "unfinished groups sequentially" to begin. Check totals and rejects after each group.
