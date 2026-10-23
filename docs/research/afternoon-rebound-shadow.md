# Afternoon rebound shadow study (research only)

## Purpose
Investigate whether an early rise followed by a morning drawdown can be distinguished **before** an afternoon recovery. No trading, alerts, production scheduling or claims of predictive accuracy.

## Point-in-time protocol (JST)
- Freeze candidate universe and 09:05 snapshot at 09:05; never select candidates using later outcomes.
- Capture 09:10, 09:30, 10:00, 11:00, 11:30, 13:00, 14:00, 14:10, 14:30 and 15:30 snapshots only when timestamps and market sessions are valid. Do not fabricate missed observations.
- Save exchange, security code, trading date, capture timestamp, source/provider, price basis, data freshness, licensing/usage status, and missing-data reason.
- For analysis at 14:10, only features available by 14:10 are allowed; high/close reached later are outcomes, not inputs.
- Keep opening auction, trading halts, limits, splits, corporate actions and no-quote days explicitly separate.

## Research questions
1. Among 09:05 candidates, how often does price fade by 10:00?
2. Among morning faders, how often does the afternoon recover the morning high, **equal** it, or strictly exceed it?
3. Which point-in-time signals at 11:00, 13:00 and 14:10 distinguish subsequent recoveries from continued weakness?
4. Compare hypothetical 14:10 limit exits (+0.5%, +1%, +2% relative to quote) with conservative fill assumptions; unfilled orders stay unfilled. Include slippage, commissions, tax treatment, and risk/downside scenarios separately.

## Definitions
- Morning window 09:00–11:30 JST; afternoon 12:30–15:30 JST (verify applicable trading-calendar session for the date).
- Afternoon high **equal** to morning high is a retest, not a breakout. Strictly higher is a breakout.
- Rebound from a morning low is a descriptive hindsight metric unless low was already observed at the decision timestamp.
- Do not interpret the day's absolute high as the exact timestamp of execution without an execution record.

## Quality and rollout gates
- Phase A: isolated deterministic calculations + synthetic unit tests.
- Phase B: verify approved intraday source, timestamp semantics, data rights, actual coverage and missingness; no source => unavailable, not zero.
- Phase C: point-in-time shadow storage with idempotent keys and read-only admin review, isolated from live trading.
- Phase D: forward holdout evaluation over multiple weeks/months, report sample size, selection bias, uncertainty, missingness and fill assumptions.
- No user-facing forecast, notification, paid data plan, production cron, or auto-trading without separate review and explicit authorization.

## 2026-10-23 illustrative case
3762 テクマトリックス: user-reported approx. 14:10 quote 3,485 JPY; 3,510 JPY limit order executed for 100 shares; tax/fee-exclusive realized gross gain 9,500 JPY against 3,415 JPY cost basis. Daily high 3,510 JPY. This is **one retrospective anecdote**, not a validated market dataset or measured success rate. Do not infer morning vs afternoon high from a daily candle alone.
