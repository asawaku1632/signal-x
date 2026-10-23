# Dual surge research — isolated design (2026-10-23)

Status: DESIGN ONLY. No production integration, cron, migration, or notification enabled.

## Existing components to preserve
- MM_V1 is a high-AI / subsequent low-AI rebound research pattern, not a price-breakout precursor.
- BB prospective forward core `app/lib/research/bollingerForwardCore.mjs` freezes signal-day closing data and grades 1/3/5 sessions. It must remain unchanged.
- Technical observations already calculate RSI, MACD, EMA, ATR and 20-session volume ratio.
- The original 20-stock BB basket includes 3762. Historical archived and prospective samples must never be combined as if both were prospective.

## Two independent, prospective research cohorts
1. PRE_SURGE_V1: potential *before* acceleration. Candidate inputs: completed daily closes, 20-day volume baseline, volatility compression, rising lows, proximity to previous 20-session high. Record candidates even if they never surge. Exclude same-day breakout and already-accelerated cases. Do not infer future labels at capture time.
2. SURGE_START_V1: first confirmed *start* of acceleration. Candidate inputs: first completed daily close breaking a prior 20-session high, price change versus previous close, completed-session volume ratio and prior-day absence of the same breakout. Keep as-of timestamp explicit. This is not a 09:05 signal; intraday data must be separately sourced and timestamped.

All thresholds are hypotheses, versioned and frozen *before* outcome collection. No tuning on the evaluation cohort. Each cohort gets separate candidate counts, false positives, return distributions and drawdown outcomes. An overlap can be recorded but never silently deduplicated across cohorts.

## Required immutable capture
research_version, cohort, code, trade_date, signal_timestamp_jst, available_at_jst, source/provider/license status, OHLCV adjustment and split status, source fingerprint, close, volume, reference window, feature snapshot, calendar version, capture status and reason. Unique (research_version, cohort, code, trade_date); append-only. Missing/late/unlicensed data => unavailable, not zero or simulated.

## Forward grading
Grade from a stated *executable reference* (e.g. next session open when available), with 1/3/5/10/20 trading-session horizons; include max adverse excursion, fees/slippage sensitivity and benchmark excess return when licensed benchmark data exists. Exclude splits or revised sources until reconciled. Report completed denominator, observation dates, unique tickers and uncertainty. Keep backtest and forward cohorts strictly separate.

## Rollout gates
1. Confirm licensed, timestamped OHLCV availability and existing 950-stock scope; inspect vendor quotas and existing schedules.
2. Implement pure detectors with synthetic unit fixtures for boundary/anti-lookahead tests; synthetic fixtures never become research observations.
3. Add private additive schema and owner-only read endpoints; verify RLS and idempotent writes on development DB.
4. Add owner-only dashboard with independent cohort results and missing-data reasons.
5. Start small shadow cohort; verify forward capture, subsequent grading, provider revisions, quotas and failed-source behavior before expansion.
6. Do not enable public ranking, alerts, automated trades, or production writes without explicit release approval.
