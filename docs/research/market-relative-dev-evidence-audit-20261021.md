# Market-relative evidence audit — development only — 2026-10-21

Scope: read-only SQL against Supabase development project `signal-x-dev` (`jdtqwryiyxeuoraecorw`). **No production inspection, data copy, inserts or changes.**

## Observed row counts
| Table | Rows |
|---|---:|
| `public.bb_signal_events` | 425 |
| `public.bb_signal_event_results` | 5 |
| `public.technical_signal_events` | 313 |
| `public.technical_signal_event_results` | 0 |
| `public.market_index_shadow_observations` | 0 |
| `public.ema_forward_shadow_trades` | 0 |

## Field coverage
- BB signals: 425/425 have `display_ai_power_after_bb` and 425/425 have positive `entry_price`. Signal dates: 2026-04-24 through 2026-08-10.
- Technical signals: 0/313 have `display_ai_power_snapshot`; 313/313 have positive `entry_price`. Signal dates: 2026-08-14 only.
- Results alone do not establish matched stock/index entry/exit timestamps.
- No indexed observations are stored in the development shadow table; market-relative returns cannot be calculated responsibly from these tables now.

## Interpretation and blockers
1. These are **development** counts, not production totals or prediction accuracy.
2. Frozen BB AI POWER may be usable as a historical research feature, but the original score's meaning and timing must be confirmed.
3. Technical signal scores are missing: exclude rather than reconstruct them from current scores.
4. Do not use 5 BB result rows as a meaningful accuracy estimate.
5. Independently timestamped market benchmark values, stock entry/exit observation times, matched horizons, source rights and provider reliability remain unresolved.
6. Existing `marketRelativeEvidenceGate` requires exact timestamp equality across stock/index observations, which is intentionally strict and can exclude otherwise alignable bars. Before real scoring, define a reviewed bar-alignment convention and validate session/date, not silently relax it.
7. All current synthetic tests verify functions, not end-to-end live source ingestion.

## Next safe steps
- Read-only mapping of BB signal/result schema and source timestamps.
- Confirm index provider (TOPIX Yahoo candidates returned 404); never backfill a guessed symbol.
- Design a *separate* development-only read-only evidence adapter, initially reporting missing fields only.
- Run a small, dated, reviewed forward observation sample before claiming AI performance.
- Keep draft PR #196 unmerged; no production migration, cron or notification changes.
