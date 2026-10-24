# WATCH vs same-day 950-symbol universe — 5-session outcome

Read-only production SQL against `public.swing_universe_observations`, six fully matured five-session assessment dates. For each date, baseline = equal-weight arithmetic average of recorded `return_5d` across all 950 observed symbols, **not** TOPIX or Nikkei. WATCH = average of that day's frozen WATCH labels. Difference is percentage points.

| Signal date | 950-symbol mean | WATCH mean | WATCH minus baseline |
|---|---:|---:|---:|
| 2026-10-08 | +1.181% | +3.445% | +2.264 pp |
| 2026-10-09 | +0.298% | +0.610% | +0.312 pp |
| 2026-10-13 | -1.770% | -2.044% | -0.274 pp |
| 2026-10-14 | -1.084% | +0.292% | +1.376 pp |
| 2026-10-15 | -0.005% | +1.279% | +1.284 pp |
| 2026-10-16 | -2.016% | -0.774% | +1.242 pp |

WATCH exceeds equal-weight universe on 5/6 dates, but the evidence is **six correlated market dates** and does not establish out-of-sample predictive superiority. This is a close-to-close recorded return comparison; it is not an executable next-session-entry P&L. No market-cap/sector controls, costs, slippage, taxes, corporate actions, or confidence intervals. No rule, DB, or production changes. Further work: compare WATCH against AVOID and WAIT within each date; inspect sector mix, date-level confidence, and entry-time availability.
