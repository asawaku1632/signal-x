# SIGNALX — Standard daily-data AI improvement plan (2026-10-26)

## Objective
Convert already saved AI predictions and independently verified daily closes into actionable, auditable candidate changes. No additional paid J-Quants addon. This is a **plan**, not evidence that a backtest or licensed integration has run.

## Scope and guards
- Standard plan: daily OHLC only, not 09:05 minute bars.
- Historical provider calls, persistence, commercial use and redistribution are **not** enabled by this document. Confirm applicable J-Quants rights for private research and downstream SIGNALX user-facing results before use.
- Do not change production rankings, AI POWER, notifications, trades, cron, or existing prediction records.
- Never replace the originally captured prediction-time reference price with a later price. Keep source, timestamp, adjusted/unadjusted basis and corporate actions explicit.
- Missing future prices, nontrading days, delistings, splits and stale quotes are unresolved, not wins.

## Join contract — read-only first
- Key: (prediction_trade_date, canonical_security_code, original_prediction_id).
- Preserve prediction timestamp, original AI POWER, original category and reference price.
- Reference future daily close at +5, +10, +20 **trading** sessions, with date and provider provenance.
- Flag ticker mapping conflicts, corporate actions and missing observations. Exclude them from headline verified denominators while showing counts.
- Dedupe repeated observations without erasing multiple distinct prediction timestamps; avoid treating the same symbol/date as independent evidence in uncertainty estimates.

## Evaluation
- Per AI POWER band and original label: eligible, matured, verified, excluded, mean/median forward return, positive-rate, negative-tail rate, and benchmark-relative performance when legally available.
- Show 95% uncertainty intervals and sample sizes; do not rank tiny groups as proven improvements.
- Compare with a baseline (existing rule or simple reference) using **chronological** holdout and rolling forward validation, never random leakage-prone splits.
- No cherry-picking across thresholds without multiple-testing control. Costs, spreads and realistic entry assumptions must be disclosed.
- If a proposed change only improves the development window, label it NOT VERIFIED and do not promote.

## Promotion gate
1. Document original rule, proposed rule, hypothesis and target population before validation.
2. Produce reproducible read-only cohort export/aggregate with query revision and provider provenance.
3. Confirm price quality, corporate actions, timestamp and legal use.
4. Independent holdout must show credible improvement and no unacceptable worsening of downside risk.
5. Owner review and explicit approval before any production implementation, followed by shadow comparison and rollback plan.

## Immediate next implementation
- Inspect actual existing prediction/outcome tables and query paths, preferably read-only; **do not invent table names or fabricate row counts**.
- Map the real columns to the join contract.
- Build a pure offline evaluation module and synthetic tests first, then integrate only after license and data access checks.
- Current status: design recorded; no J-Quants calls, DB writes or real performance evaluation performed by this commit.
