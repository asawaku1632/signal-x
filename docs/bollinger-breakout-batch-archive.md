# Bollinger breakout 20-stock retrospective archive (manual Stage 2)

## Scope
The existing owner-only two-stock read-only page stays operational. Stage 2 adds a separate manual saved-study section to the same page, with 4 predetermined groups of 5 codes (20 distinct stocks including 9984 and 3762).

- Max 5 Yahoo daily-history requests per owner click, 2 concurrent, no automatic retry.
- A unique database claim (batch_id,target_date) happens BEFORE the first price provider request, permanently stopping repeat lookups for that batch/target session.
- There is **no Cron, new deployment, notification, AI POWER/buy/sell/ranking impact**.
- Individual mature outcomes for +1, +3 and +5 trading days are inserted into two isolated research tables. The primary key is detector_version + code + signal_time + horizon. Re-evaluations insert only newly mature horizons; never UPDATE old outcomes.
- Every duplicate stored outcome must have the same source fingerprint, or the whole transaction rolls back for price-revision review. The fingerprint covers the original 80 sessions, signal session, calendar version, and the specific forward window.
- All 5 symbols must pass OHLC, split-event and strict official 2026/2027 trading-calendar validation; an invalid batch saves no results. Historical bars are never used to trade.
- Aggregates are computed only from saved outcomes, and percentages/mean returns remain hidden until >=30 complete records per category/horizon. This is NOT prospective OOS validation and the curated symbols are NOT a random sample.
- Old two-symbol results were screen-only, never archived, and are not automatically treated as saved results: run batch 1 (which includes the original two) to create audited records.
- Results represent illustrative next-session-OPEN entries and 1/3/5-session closing exits; they exclude fees, slippage, liquidity/fill risk and corporate actions outside excluded windows.
- The batch ledger claim is not reset after an error: try a new *target trading date* later rather than repeatedly retrying the same provider calls.

## Rollout order / safety gates
1. Review the draft PR, pass both GitHub test suites, Next typecheck, and all Vercel preview checks.
2. Apply the isolated migration to the designated SIGNALX database. Confirm RLS and table privileges; do not run any historical batch automatically.
3. Merge the PR to production only after migration and checks. Verify production deployment and owner-only route accessibility.
4. On the owner UI click one five-symbol group and review the resulting quality and de-duplicated storage; do not assume outcomes have been saved before this click.
5. Do not add a daily cron or broad-universe sampling without a separate review of provider rate and compute budgets.

Tests:
node --test tests/bollingerBreakoutShadow.test.mjs tests/bollingerBreakoutQuality.test.mjs tests/bollingerBreakoutBatchArchive.test.mjs

DB migration:
supabase/migrations/20261015_bb_breakout_shadow_batch_archive.sql
