# 2026-11-01 SMA75 preliminary stored-chart review — shadow only

**NOT a J-Quants 76-session validation. NOT eligible for production, AI POWER, alerts, or trades.**

Source: SELECT-only aggregation of existing `public.display_snapshots` 1D Yahoo chart JSON, joined to the 2026-10-30 frozen `daily_stock_results` codes. There were 953 frozen symbols; 125 have cached daily charts and 828 have no saved charts. The 125 are an app-selected convenience sample (121-123 bars each), with older final bar dates for 123/125. No independent capture, vendor license, calendar, or split/rights provenance was established.

Method: SMA75 close crossover, after 75 warm-up bars, next-session open entry with 0.1% adverse price, five-session close exit with 0.1% adverse price. Order 100 shares; filter entry notional 100,000-500,000 JPY. Reject >45% close discontinuity in 75-session context plus five outcomes (crude gap proxy, NOT verified split protection). No fees, taxes, dividends, actual orders, or fill quality. Overlapping events are correlated.

| Archived chart sample | Result |
|---|---:|
| Mature 5-day breakout signals within initial budget | 106 |
| Unique breakout codes | 48 |
| Positive 5-day share | 55.66% |
| Average 5-day return | +0.430% |
| Median 5-day return | +0.640% |
| Average yen P&L per 100 shares | +126 JPY |
| Worst observed 5-day percentage | -17.27% |

For a fairer breakout versus retest comparison, require **15 subsequent observed sessions**: ten-session retest wait and five-session retest outcome. Retest means SMA75 support touched within 1%, close back at/above SMA75, close at/above open, and no previous daily close below SMA75. Entry is NEXT open, not same day's low. Missing retest means **cash at zero**, not a losing trade.

| Matched initial-budget 83 opportunities | Buy immediately after breakout | Wait for retest or cash |
|---|---:|---:|
| Initial event denominator | 83 | 83 |
| Hypothetical trades | 83 | 39 |
| No-trade cash | 0 | 44 |
| Average five-session P&L, 100 shares per opportunity | +55 JPY | +1,661 JPY |
| Average return per opportunity | +0.495% | +0.731% |
| Positive outcomes / all opportunities | 54.22% | 26.51% (44 cash zeros) |

Retest trades alone: 39, of which 38 had retest entry notional within the original 100,000-500,000 JPY range. Among 39 trades, 56.41% were positive, average +1.556% and +3,535 JPY per 100 shares; worst -11.01%. One over-budget retest is still included in the wait-policy comparison; an executable strict-budget implementation must quarantine it and re-estimate the statistics.

**Conclusion:** These are biased descriptive historical numbers, not a tested trading edge. No independently selected forward holdout, correct corporate-action treatment, no-trade liquidity assessment, risk-cap calibration, or full-universe data was available. Prices differ from authenticated J-Quants bars.

**J-Quants actual acquisition blocker:** The Preview environment of Vercel `signal-x` has a named `JQUANTS_API_KEY` variable, but only its non-decrypted metadata was inspected. The current tool session cannot run authenticated J-Quants HTTP requests using it without deploying or invoking a new remote execution path. **No authenticated 76-date download was performed.** The frozen-cohort 76-session SMA75 warm-up alone is not enough for 3-5 day outcomes, and far more completed signals across months are necessary for any independent performance conclusion.

All database queries were SELECT-only; no secret decryption, provider request, paid add-on, production change, notifications, or orders. PR remains Draft/shadow.
