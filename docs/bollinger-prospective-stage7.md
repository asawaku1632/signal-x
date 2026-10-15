# Bollinger Stage 7: prospective opt-in study

## Activation and rollout
- The dedicated future study control is OFF by default. Only the sole learning owner may activate it.
- Activation starts at the NEXT official JPX trading session, never on the activation date nor for retrospective sessions. First supported day: 2026-10-16.
- After-close research-only cron runs 17:30 JST weekdays when enabled, authenticated with CRON_SECRET.
- Old BB historical outcomes and research snapshots remain untouched. No changes to live AI, ranking, trades, notifications or existing cron entries.
- Before any live activation: pass offline regression, Next.js typecheck, main Vercel preview; apply additive Supabase migration, verify RLS, disabled state and ordinary-user grant restrictions; merge and verify production deployment.

## Bounded data and no backfill
- Fixed 100 stocks from prior stages, in five deterministic sets of 20, rotated by actual JPX trading session.
- This is 20 out of 100 stocks per day; observations on unselected days are intentionally unobserved. Never present as continuous 100-stock daily coverage.
- Each daily cron performs at most 20 new research fetches and 10 fetches for pending future results, concurrency <=3, with 12-second per-source timeout; no retries.
- A once-per-day durable claim occurs BEFORE requesting source data.
- Source must have a fully completed same-date Japanese daily OHLCV bar, full official trading calendar coverage, valid splits chronology and >=81 bars.
- Save an immutable prospective signal only on the day it is observed after market close. Save BB breakout type, RSI14, prior 10-day trend, breakout strength and 20-session volume ratio, SHA256 over the 80 previous bar history plus signal day and calendar/policy, captured-at timestamp.
- Never create a signal retrospectively if its target day was missed. The first subsequent completed session open is a hypothetical entry; 1, 3, 5 trading-session closes are outcomes.
- Outcome checks require identical frozen source hash. Source revision halts the old signal in an immutable separate table; no rewriting of entry, signal or factor. A stock split between signal and outcome is excluded as a win/loss, with explicit excluded status.
- Each failed stock has a distinct check record. Partial days are labelled, not assumed complete.
- No normal-user or authenticated role access to study tables; owner UI displays progress and controls.
- Win rates/mean returns hidden under 30 independently matured new samples.
- Periodic captures do not guarantee external Yahoo data source continuity, execution fills, spread/slippage, liquidity or profits. First real after-close run still needs verification.
