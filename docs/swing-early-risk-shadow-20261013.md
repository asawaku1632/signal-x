# Swing early-risk shadow research (2026-10-13)

## Case study: SoftBank Group (9984)
- User-provided simulated entry: 2026-10-07 21:44:35 JST, 100 shares at ¥6,310.
- User-provided screen price: ¥5,310; displayed P/L: -¥100,000 (-15.85%); AI POWER 9; label EXIT ("撤退候補").
- These are **case-study inputs**, not independently verified historical scan snapshots.
- The displayed "当日変化率 -0.39%" is a scan field; **do not interpret it as the exchange close-to-close daily return without checking the reference date, update time and source**.

## Existing implementation
- Production display decision: `app/lib/swingDecision.ts` (EXIT if P/L <= -3%, AI POWER < 55 or valid stop-loss breached).
- Existing exit-afterward audits: `app/lib/learning/swingExitAudit.ts` with saved results after 1/3/5/10 **trading** days.
- Therefore this screen does **not** prove the first warning appeared only on day six.

## New isolated research helper
`app/lib/learning/swingEarlyRiskShadow.ts` compares past timestamped snapshots with the production EXIT rule while separately marking **unvalidated** earlier research thresholds (P/L <= -1.5% or AI POWER < 70). It performs no database access or writes and is not connected to UI, cron, orders, notifications or scoring.

## Before historical replay
1. Collect actually retained, point-in-time scans between purchase and EXIT (code, source timestamp, price, AI POWER, stopLoss, daily change, exact rule version). No backfilling prior dates with current AI values.
2. Verify code 9984, corporate-action-adjusted versus unadjusted price scale, timestamps/JST trading session, and comparable price sources. Mark absent snapshots **unknown**.
3. Use first snapshot available *after* entry; purchase at 21:44 JST was outside TSE continuous trading hours.
4. Compare: first research warning, first original EXIT, and next 1/3/5/10 trading-session saved outcomes. Avoid claiming benefit if the earliest available scan already triggers EXIT.
5. Evaluate all positions and a control cohort, measuring false alerts, missed declines, average loss avoided and returns forfeited from rebound. Include slippage, fees and overnight gaps. Set evaluation thresholds on an earlier period, validate on a later untouched period.
6. Keep production thresholds unchanged until the experiment demonstrates an improvement in both adverse-loss protection and risk-adjusted outcome. Independent operator approval for future promotion.

## Deployment safeguards
- This change is **not deployed**. It adds only an importable pure function with no scheduled execution, storage or customer-visible changes.
- Before integration, add automated tests (missing data, duplicated timestamps, EXIT already present, trading calendar and late snapshots) and check lint/typecheck in CI.
- For display, distinguish historical test results from real-time advice; risk flags do not promise price direction.
