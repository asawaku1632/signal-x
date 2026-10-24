# Pre-entry factor coverage audit — 2026-10-24

Read-only inspection of production schema and frozen `ai_power_only_v1` WATCH cohort (49 completed 10-day outcomes, signal date 2026-10-08). No schema/data/cron/trading changes.

- `swing_universe_observations`: frozen trade_date, code, entry_price, ai_power, decision_status, captured_at, and endpoint returns at 1/3/5/10 trading sessions. No volume, RSI, MACD, or VWAP fields.
- `daily_stock_results`: date, code, score, price, next_price, change_percent, result, checked_at, created_at. No volume fields.
- Other research tables (`bb_forward_signals`, `bb_asof_factors`, `bb_breakout_volume_factors`) have volume_ratio/RSI/trend factors, but belong to separate signal universes and need validated timestamp + provenance before joining.
- Exact code/date match of the 49 WATCH signals against `bb_forward_signals`: 0/49. Do not impute missing BB factors as zero or use future BB observations.
- Prior calendar-day observation match (2026-10-07) for the 49 signals: 0/49. Cannot calculate previous-day AI POWER momentum for this cohort from frozen swing records.

## Next safe gate
1. Wait for at least two adjacent saved assessment trading dates and multiple independent 10-day-mature cohorts.
2. Use exchange trading calendar, not calendar-day subtraction, to join previous signals.
3. Audit timestamps: only features finalized before the proposed order time are eligible; use next-session executable price with transaction costs.
4. Report coverage for every feature and do not select only symbols with complete factor history without showing missingness.
5. Compare against same-date controls and no-signal baseline. Keep the study research-only until replicated.
