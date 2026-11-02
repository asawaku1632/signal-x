# Morning 09:15–09:30 manual 5-minute feed availability probe — 2026-11-02

**Draft PR research only.** No automatic schedule, no database writes, no new paid data source, no sale/purchase, no alert, no production merge.

## Why
The independent stored `morning_final_check_runs` history for 9 sessions (2026-10-21 through 2026-11-02) has **0 usable morning decisions out of 45**. Of 45 `UNAVAILABLE`, 35 were recorded as `MISSING_CANDLES` and 10 had no reason recorded. Independent after-close archived five-minute studies for the same sessions had 36 complete stock-days, showing that information was often available **later**; it does *not* establish Yahoo latency or 09:08 tradeability.

## Delivered
1. `morningProbeShadow.mjs`: deterministic timestamp/source/5-minute candle audit.
2. `GET /api/admin/morning-probe-shadow`: owner-only, manual, limited to actual JPX trading days and Japan 09:15:00–09:34:59. Each request queries the existing immutable previous-night cohort, maximum five codes, and makes at most 5 Yahoo 5-minute chart reads. No user-controlled tickers or unrestricted scan.
3. No page-load or Cron triggers. A manual anchor on the owner-only `/admin/night-morning-watch` page opens the JSON only when clicked; opening the admin page itself does **not** call Yahoo through this new route.
4. Each response includes server-side request and receipt times, exact probe slot, source/exchange time-zone verification, missing completed candle slots, and upstream-unavailable reasons. A request finishing in a later slot is invalidated. Bad provider timestamps, malformed bar OHLC, duplicate bars and absent volume fail closed.
5. In the first 09:15 probe the code requires completed 09:00/09:05/09:10 bars; 09:20 additionally needs 09:15, 09:25 needs 09:20, 09:30 needs 09:25.
6. The next **reference** bar start is strictly after receiving the observation: 09:15→09:20, 09:20→09:25, 09:25→09:30, 09:30→09:35. This reference is **not an executable price**. A retrospective entry may only be researched after the new bar was actually recorded.
7. Added scenario tests to the existing `npm run test:next-session` build gate. The route has no `INSERT`, `UPDATE`, `DELETE`, Cron or new environment variable.

## Operator workflow for prospective research (NOT automatically running)
- Next JPX session after Monday 2026-11-02 is **Wednesday 2026-11-04** (2026-11-03 is a national holiday).
- During 09:15–09:34 JST, the owner can explicitly open the probe at a desired five-minute slot. The owner can view response JSON; no persistent log is written.
- Capture source `receivedAt`, `probeSlot`, all required completed bars, and `status` in a separate approved **future** immutable research journal before drawing any conclusions.
- Failures must stay failures; refreshing later cannot turn a prior 09:08 UNAVAILABLE into a 09:08 BUY_CANDIDATE.
- If an official/authorized minute feed's actual receipt is delayed, it might be impossible to trade at the corresponding five-minute OPEN. That scenario should remain `WAIT` and not add to observed win rate.
- Only after a prospectively frozen rule, independent observations, sufficient distinct sessions and transaction-cost/fillability audits may the team consider a candidate notification. Automatic trade execution is outside scope.

## Limitations
- Yahoo is a pre-existing unofficial market quote source in this repository. It can be delayed, absent, provisional or rate-limited. The route is a **diagnostic**, not a feed SLA or an official JPX market-data contract.
- The probe is explicitly manual; no observation is saved by default, so there is **no automatic prospective accumulation**. Persistent capture or a scheduler would require separate approval, database ownership review, safe collection limits and no new costs.
- No current proof that 09:15/09:20/09:25/09:30 candles are available in real time. The only current proofs come from offline fixtures and existing after-close observations.
- The same five-code frozen cohort does not represent the entire Tokyo exchange; budget full-cohort captures proposed in this PR are disabled.
- The research module can report `AVAILABLE_AS_OF_RECEIPT`, but this means time-eligible bars in the provider response, **not** an exchange-confirmed fill or a verified rise forecast.
