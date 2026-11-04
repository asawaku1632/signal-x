# 09:05 forward evaluation: real-data intake contract

## What is available now
- Offline minute reports: 3 inspected locally by the operator, 2 structurally accepted, 1 excluded, only 1 accepted trade date.
- No independent as-of 09:05 signal capture has been demonstrated.
- The forward evaluator accepts **a separate array of independently verified trade outcome records**, not the historical minute reports. Do not rename or transform the three reports into fake trade outcomes.

## Required input (JSON array)
Each record requires:
- `code` (four-character TSE code), `date` (JST trade date), `strategy` (predeclared rule name).
- `lastInputBarEndAt`, `receivedAt`, `decisionAt` (offset-aware ISO timestamps; all at/before 09:05 JST in chronological order).
- `independentCapture: true`, `sourceVerified: true`, `lookaheadFreeVerified: true`. These are **claims in the input**, not independently proven by the evaluator.
- `entryAt`, `exitAt` (offset-aware ISO timestamps), `entryPrice`, `exitPrice`, `fillVerified: true`.
- `holdingTradingDays` (integer 1–5; the evaluator does not yet independently verify exchange trading calendars).
- `outcomeComplete: true`, `outcomeKnownAtDecision: false`.

## Offline execution after independent evidence is obtained
```powershell
node .\scripts\research\post905-forward-evaluation.mjs --input=verified-trades.json --output=forward-evaluation-v1.json --cutoff-date=2026-10-30 --fee-bps=10 --slippage-bps=5
```
The numeric fees and slippage above are illustrative sensitivity inputs, not verified broker charges.

## Safety / remaining research requirements
1. Locate the actual stored research source using **metadata only**; do not print or share DATABASE_URL, passwords, or API keys.
2. Export only an authorized read-only, bounded, pseudonym-free subset of relevant fields. No production DB connection without explicit permission.
3. Reconstruct a strategy using independently recorded inputs available by 09:05, not historical highs or hindsight.
4. Define a fixed training cutoff before seeing test outcomes. Training outcomes that complete after the cutoff must be excluded.
5. Confirm actual TSE trading days, realistic entry and exit fills, spreads, slippage, fees, and corporate actions.
6. Run multiple dates, symbols, market regimes, and rolling out-of-sample windows; compare to a suitable benchmark and account for multiple testing.
7. Do not promote a strategy to notifications or production based on this evaluator alone. Its result always remains descriptive-only.

No external API, DB, broker or notification access is performed by the offline evaluator.
