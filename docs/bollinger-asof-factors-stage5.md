# Stage 5: as-of RSI, prior trend and upper-band strength in the 100-stock BB study

## Research-only scope
The 20+80 fixed universe already yielded 483 historical breakout events and 1,424 future-horizon results, all frozen. Stage 5 adds **immutable independent factor rows** to a new table. No rows in the original 3 outcome/volume tables are updated, deleted or re-labelled.

## Ex-ante metrics (all computed through the completed signal session t)
1. RSI14: rolling arithmetic average of 14 completed close-to-close gains/losses (NOT Wilder smoothed). 50, 70 boundaries.
2. Trend10: (close[t]/close[t-10]-1)*100, grouped <0%, 0–<5%, >=5%.
3. Breakout strength: (signal close / prior completed 20-session Bollinger upper 2σ -1)*100, grouped <2%, >=2%.

All these values become known **at the close of t**, so the graded entry remains **NEXT trading session open**. Future t+1/+3/+5 candles may only be used for an outcome and for reproducing the previous immutable hash, never as feature inputs.

## Safety guarantees
- Fixed batch universe: 20 groups of 5 codes, same as Stage 2 and Stage 4, all in one owner-only research page.
- One owner-triggered button can sequentially process unfinished groups, with stop/resume while the browser is open. Max 5 provider history calls per POST, <=2 concurrent, no automatic retries. A DB claim occurs BEFORE provider requests; previous completed groups are skipped. Same target trading date cannot be retried.
- Source loader and JPX official calendar are reused and checked for every 5-stock cohort. Corporate actions within original 80-bar / outcome window are excluded by the same original detector.
- Each stored 1-day result must reproduce exactly via code+timestamp, group, close, and SHA-256 of the original 80-bar history, signal bar and next day. If not, STOP with no partial factor rows.
- Store one immutable factor per original event (detector version, stock code, signal timestamp). No source overwrite. 5-symbol cohort all-or-nothing.
- For comparison, show each factor's buckets independently by squeeze vs ordinary breakout and by +1/+3/+5 sessions. Never show a win rate / average for <30 complete observations in a bucket. There are numerous comparisons; historical 'best' is exploratory and cannot be treated as validated trading performance.
- This feature **does not** model AI POWER at original signal time, actual same-day market-hours entry, slippage, fill availability, liquidity, sector regime, or future success guarantees. A separate prospective period is required before any production trade decision.

## Activation
After all offline tests and 3 Vercel preview checks are green:
1. Apply only supabase/migrations/20261015_bb_asof_factor_research.sql to SIGNALX production, confirm RLS enabled and anon/authenticated privileges absent.
2. Merge the PR without modifying trade, ranking, AI score, notification, Cron or DEV Phase7 lab.
3. Confirm production deployment; user can start an owner-only 20-batch manual verification via Stage 5. Until that happens, there are no additional RSI/trend/strength outcomes stored.
