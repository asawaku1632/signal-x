# Scan score provenance — forward-only research specification (2026-11-13)

## Why
2501 Sapporo HD was archived at 2026-11-13 09:06 JST with raw AI POWER 92, reference price 2162 JPY and latest Yahoo candle timestamp 2026-11-12 09:00 JST. This is a genuine archived score, but **not evidence of a post-09:05 intraday signal**. Existing ai_power_scan_audit records only the final score, reference price and one latest-bar timestamp; it cannot reconstruct all historical inputs.

## Required append-only capture (research only)
For each code and capture slot, persist:
- scan_generated_at, capture_started_at, capture_completed_at, snapshot_key, code, model_version and code commit SHA
- raw_ai_power, displayed_ai_power, reference_price, rank, score_breakdown JSON and input fingerprint SHA-256
- per-source provenance: source name, fetch start/end, newest data observation timestamp, timezone, resolution, dataSource (intraday/daily_fallback), request status
- feature input snapshot (or immutable content-addressed artifact), pattern observations, market-pattern snapshot, and learning-statistic identifiers and **as-of** timestamps
- explicit boolean `eligible_post905` and reason code, default false until validation

Do not record tokens, cookies, credentials, personal information or unrestricted vendor response bodies.

## Time integrity requirements
1. Every observation timestamp must be <= scan computation cutoff, and every learning statistic must be generated from data available before that cutoff. Timestamp checks alone do not prove point-in-time availability.
2. For post-09:05 research, require an **actual same-day** intraday bar with observation time >= 09:05 JST and <= computation cutoff; a previous-day daily candle or 09:03 bar fails.
3. A failed/stale intraday request must never silently count as a successful post-09:05 intraday signal. Record fallback explicitly.
4. Reject missing/ambiguous timestamps, missing provenance and missing feature snapshot; no optimistic default.
5. Freeze input and output before the outcome window. Never backfill reconstructed scores as original pre-event predictions.
6. A 3/5-business-day return uses a separately timestamped, executable-price proxy; report spread/slippage/fees assumptions and censor unavailable prices.

## Rollout gates
- Shadow-only table or private immutable artifact, no production ranking/notification/order effects.
- First add unit tests for stale bars, fallback, future-dated inputs, duplicate slots, missing learning as-of times and timestamp timezone handling.
- Then verify deterministic score reproduction using the captured feature inputs and pinned model version.
- Run forward on multiple dates before judging predictive accuracy. Keep the 2026-11-13 2501 case as `PRE_EVENT_SCORE_ARCHIVED / POST905_UNVERIFIED`.

## Status
This document defines the proposed instrumentation contract. No database migration, runtime instrumentation or deterministic replay has been implemented by this document alone.
