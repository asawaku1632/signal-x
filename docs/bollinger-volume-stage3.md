# Bollinger + confirmed-day volume study (SHADOW-only Stage 3)

## Why this stage
20 curated Japanese stocks have 103 frozen BB breakout events, with 300 1/3/5-session graded outcomes. The saved outcomes do NOT contain original signal-day volume, AI POWER, or intraday entry prices. Without those, pretending that full multi-factor backtests are available would introduce bias/lookahead.

## This PR
- Adds a **separate immutable** volume-factor table, distinct from the 300 frozen outcomes.
- Adds a new manual, owner-only section below the existing BB archive.
- Four frozen 5-stock batches, maximum 5 Yahoo daily 2-year requests per click, maximum 2 concurrent, no automatic retry.
- A once-per-target-completed-session DB claim is inserted **before** any Yahoo calls. Repeated presses that day never refetch.
- Price source must reproduce the **exact previously saved signal event + original 1-day fingerprint**; all five stocks' price/calendar/corporate-action checks must pass before any factor is saved.
- For each archived signal, volumeRatio = signal day volume / 20 earlier completed days' average volume. This signal is known only AFTER market close; hypothetical entry remains the NEXT trading session open.
- Compare HIGH (>=1.3x), BELOW (<1.3x), UNKNOWN separately for squeeze and ordinary breakouts at +1/3/5 trading sessions. Ratios null if volume source inadequate, not converted to zero.
- Each unique (detector version, code, signal time) receives one immutable factor row; subsequent source revisions fail closed rather than overwriting.
- Percent positive, average return and average adverse movement remain hidden until >=30 observed records for each individual subgroup/horizon.
- No broad universe sampling claim; all original samples are historical retrospectives with possible correlated events.

## Not yet implemented / no retrospective invention
- 64/103 stock-day signals overlap same-day daily_stock_results scores, but the source's score, publication timestamp, and as-of availability need separate verification before claiming an AI POWER effect.
- Five signals overlap the bb_signal_events source; this is far too few to support a multi-factor finding.
- No corresponding entry-time research snapshots overlap the 103 signal dates. Thus 09:05-versus-11:00 comparisons cannot be performed on this dataset.
- Future prospective studies can freeze AI POWER snapshots at signal-time and compare 09:05 / 11:00 using timestamped five-minute candles in a separate, clearly labelled paired cohort. No retroactive fill prices.

## Activation boundaries
Review CI offline tests, TS build and all Vercel previews first. Apply migration exclusively to SIGNALX production project, verify row-level security and no grants for public/authenticated, then merge the PR. **Do not automatically run vendor requests, deploy a Cron, or mutate AI/signal/notification code.** Owner manually chooses each batch after deploy. Database outcomes remain unchanged.

Test command:
node --test tests/bollingerBreakoutShadow.test.mjs tests/bollingerBreakoutQuality.test.mjs tests/bollingerBreakoutBatchArchive.test.mjs tests/bollingerVolumeFactors.test.mjs
