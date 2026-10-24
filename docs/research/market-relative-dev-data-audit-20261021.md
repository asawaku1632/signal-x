# Market-relative research — development data audit (2026-10-21)

Read-only queries against Supabase development project `jdtqwryiyxeuoraecorw`. No production reads or writes, and no migrations applied in this audit.

| Table | Rows | Notes |
|---|---:|---|
| `public.technical_signal_events` | 313 | All dated 2026-08-14; 313 have detected_at and entry_price; **0** have display_ai_power_snapshot |
| `public.technical_signal_event_results` | 0 | No forward outcomes |
| `public.bb_signal_events` | 425 | Dates 2026-04-24 through 2026-08-10; 425 have display_ai_power_after_bb and entry_price |
| `public.market_index_shadow_observations` | 0 | No independently timestamped index observations |
| `public.morning_market_forward_runs` | 0 | No morning forward runs |

## Interpretation
- Do not describe the 313 technical events as AI POWER–stratified observations: their frozen display score is null.
- The 425 BB events have a stored AI POWER snapshot but this does not establish valid market benchmark prices, same-window timestamps, or forward outcomes.
- No eligible market-relative live outcome is established by this audit.
- Do not backfill old index observations with current Yahoo quotes or use date-only daily prices as 09:05 observations.
- Before a live study, separately verify complete original signal snapshots, forward outcome prices/timestamps, index source and usage rights, and the correct original data universe.
- Dev data may not match production data. Do not infer production row counts from this audit.

## Next gate
Prepare a read-only adapter with explicit exclusion reasons and inspect one limited sample before any automated writes or production changes.
