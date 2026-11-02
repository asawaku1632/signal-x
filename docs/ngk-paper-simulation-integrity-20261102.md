# 2026-11-02 NGK (5333) paper-profit integrity incident

**Scope:** Draft changes to simulated trades and user interface. No production deployment, live order, automatic sale, model reranking, database migration or new paid feed.

## Observed user screenshot
- Code: 5333 NGK (former Nihon Gaishi).
- Simulated opened: 2026-11-01 21:40:13 JST, **Sunday, when TSE is closed**.
- Simulated assumed entry: JPY 4,613, 100 shares. The amount exactly matches the **2026-10-30 TSE close**.
- Displayed reference price 2026-11-02: JPY 4,949, reference paper P/L +JPY 33,600 (+7.28%).
- UI showed 'EXIT' based on AI POWER 0 and day change -1.28%.
- NGK posted upward-revised full-year guidance and dividend revision at 2026-10-30 15:40 JST, **after** the 10/30 close. Market news reported a buy-indicated open 11/2.
- Therefore the screenshot's paper gain is mathematically correct for the saved price pair, **not evidence that a 4,613-yen entry was achievable on Sunday after that earnings news**.
- The 2026-11-02 TSE opening trade was reported as **JPY 5,013 at 09:15** (Yahoo quote page). Comparing an opening-trade *hypothetical* 100-share entry with the screenshot's JPY 4,949 gives **-JPY 6,400**, rather than +JPY 33,600. This is arithmetic, not proof of any individual's executable broker fill. https://finance.yahoo.co.jp/quote/5333.T

Sources:
- https://finance.yahoo.co.jp/quote/5333.T/disclosure
- https://s.kabutan.jp/news/n202611020173/
- https://s.kabutan.jp/stocks/5333/news/?news_category_id=3

## Root causes in repository
1. `app/simulation/page.tsx` passed cached scan quotes into EXIT labels without checking the API-provided `updatedAt`; it could also reuse the *purchase-time* AI score as if it were current.
2. `app/api/simulation-stocks` explicitly returns stored snapshots immediately, even when stale.
3. `app/lib/swingDecision.ts` legitimately marks AI under 55 as EXIT, regardless of a large current reference gain. Actual reported AI 0 may be real or a source-data issue: the screenshot does not prove a parser failure.
4. `POST /api/paper-trades` historically accepted a client-submitted reference price even outside exchange hours.
5. The old server converted `null` purchase-time AI to 0, conflating not-observed with a measured 0.

## Proposed fixes
- Add `assessPaperMarketGate`: JPX calendar-aware, 09:05 or later and before 15:25, outside lunch, scan update on same JST trading date, at most 2 minutes old.
- Block new simulated *fills* in POST and PATCH unless the server finds a matching recent saved stock quote. Reject mismatches above 0.1%, require 100-share reference investment amount.
- In UI, no longer use original `t.aiScore` to substitute for a missing live score.
- Display `DATA_WAIT` instead of a fresh-sounding EXIT when scan data is missing/stale/off-session.
- Mark existing historical off-session paper entries (including Sunday 11/1) clearly as **reference profit only; fillability not validated**. Keep them; do not delete or rewrite historical trades.
- Preserve `EXIT` for a **verified current** AI=0 under the current policy; weak AI may still legitimately imply exit risk even when a position is up.
- Keep database audit semantics unchanged. Future research must compare fresh warnings with the saved exit-audit cohort separately rather than silently overwrite older records.
- New tests for holiday/weekend, 09:05, auction boundary, stale score, zero vs missing, and API guards.

## Important limitations / release gates
- A **freshly saved scan timestamp does not guarantee a fresh underlying source quote**, especially for delayed Yahoo data. The patch prevents known stale reference fills, but does **not** prove executable bid/ask prices or latency-free fills.
- Need verify each constituent quote timestamp and source session; 5-minute bars with market-open gaps, trade availability, bid/ask, price limits and slippage. No successful broker execution is implied.
- The UI and API gate can restrict simulated trading when scans are older than 2 minutes. Do not merge before UX review of this restriction, side-effect tests and a complete local/CI build.
- Existing gains remain visible but not independently validated for comparison with a prior-night forecast.
- Confirm the 5333 scan's real score source and `rawAiPower` before treating displayed zero as genuine.
- Run `node --test tests/paperSimulationIntegrity.test.mjs tests/swingExitAudit.test.mjs` and `npm run build` (not yet run by connected tooling), then check CI statuses. Require explicit owner approval before production merge.
