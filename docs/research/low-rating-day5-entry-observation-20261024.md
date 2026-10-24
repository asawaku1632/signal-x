# Day-5 hypothetical entry check — 2026-10-24

Read-only production database analysis; no writes. Frozen `ai_power_only_v1` WATCH cohort dated 2026-10-08, 49 symbols with day-5 and day-10 outcomes. This is ONE signal date, not 49 independent market days.

Compute subsequent return as `100 * ((1 + return_10d/100) / (1 + return_5d/100) - 1)` rather than subtracting percentage returns. Day-5 AI POWER is matched to the same code at signal date +7 calendar days (five trading sessions for this cohort). Confirm timestamp availability before any executable backtest: same-day saved close cannot be assumed fillable at that close.

| Day-5 power change | N | Up | Mean subsequent return |
| --- | ---: | ---: | ---: |
| >= +10 | 20 | 10 | -0.73% |
| >0 and <10 | 5 | 1 | -0.61% |
| <=0 | 24 | 9 | -0.20% |

| Day-5 status | N | Up | Mean subsequent return | Median |
| --- | ---: | ---: | ---: | ---: |
| CANDIDATE | 16 | 8 | -0.74% | +0.18% |
| WAIT | 8 | 2 | -1.30% | -1.18% |
| WATCH | 1 | 1 | +4.44% | +4.44% |
| AVOID | 24 | 9 | -0.20% | -0.57% |

Exploratory only. Fees, spreads, fills, slippage, corporate actions, and survivorship/coverage checks not fully audited. Do not auto-change buy rules. Next experiment must use signals available *before* the entry, price at next executable session, and multiple independent signal dates with matched market controls.
