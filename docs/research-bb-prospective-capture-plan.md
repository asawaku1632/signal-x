# BB prospective capture — source audit and safe integration plan

Status: research design only. No production AI, cron, notification, or existing BB write-path changes.

## Confirmed existing code

- `app/lib/learning/bbObservation.ts`: `saveBbSignalEvents(signalDate, stocks)` inserts historical BB events and updates states. Its `BbObservationStock` includes code/name/price/bollinger/AI scores, but **no** original signal-generation timestamp, price observation timestamp, provider identity, or model version.
- The `bb_signal_events` table has `created_at`, but that is DB insertion time, not proof of contemporaneous prediction.
- `app/api/scan/route.ts` uses `latestBarTimestamp` to report quote-date bounds; this is not itself evidence that the BB decision was generated at that time.
- `app/lib/research/fixedCohortJudgmentStore.ts` uses `quoteTimestamp` and `snapshotSavedAt`, but this is a separate research pathway and cannot be assumed to be the BB source.
- DEV `bb_prospective_research_intake` holds **manual unverified** submissions only. It is not a prospective evidence ledger.

## Required provenance capture before claiming prediction evidence

1. Identify the exact BB signal computation entry point and the stock payload's price source. Instrument only a dedicated DEV/Preview research flow, not the production BB pipeline.
2. Capture `signal_generated_at` at the moment the detector produces a decision (server time); capture `quote_observed_at` and `bar_end_at` from provider metadata, not inferred from `created_at` or trade date.
3. Include `provider`, `provider_license_status`, `model_version`, `detector_version`, `signal_date_jst`, `code`, `price`, `signal_payload_hash`, `captured_at`, and immutable original payload digest.
4. Fail closed when any required timestamp/source is absent, when quote/bar end occurs after signal, or when saved after allowed latency. Do not backdate or upgrade manual intake.
5. Store immutable raw evidence in a new research-only table with RLS and no client privileges. Use append-only insert with unique idempotency key, and isolate DEV credentials. No promotion to verified outcomes on insert.
6. Collect future close/return outcomes separately, after each trading horizon matures; enforce exchange calendar, price adjustment consistency, and no leakage.
7. Independently verify provider license, timestamp semantics, completeness, and multi-day forward performance before any production consideration.

## Immediate blockers

- Original signal generation timestamp is not available in the existing BB event rows.
- Provider attribution and bar timestamp provenance must be traced through the BB computation caller.
- DEV manual intake API is not a substitute for automated observation.
- Any research implementation must be tested on Preview/DEV only; no automatic backfill of the 419 August 10 rows.
