# Prospective capture integration plan (SHADOW ONLY)

## Verified current boundaries (code inspection)
- app/lib/scanSnapshot.ts refreshSnapshot runs runScan, creates a mutable display payload and sets updatedAt at payload construction. Display snapshot time is **not** independently attested signal generation time.
- app/api/cron/bb-observation/route.ts reads getLatestScanSnapshot and validates coverage, then calls saveBbSignalEvents(targetDate,stocks). The cron's runId and stage timestamps are operation logs, **not** original per-security signal generation evidence.
- Existing research_scan_feature_captures table has zero records in development (read-only DB inspection). Do not backfill it by inventing generation times.

## Safe future integration, not yet connected
1. At the actual runScan signal-generation boundary, generate a unique per-signal ID and record generator timestamp **at generation**, not at a later cron or display refresh.
2. Record source observation timestamp, source bar close timestamp, provider identity and licensing evidence; never treat self-declared flags as independent attestation.
3. Persist immutable source and signal evidence with content hashes and append-only policy in a dedicated research store. Verify database RLS, access controls, idempotency, duplicate IDs, timezone, and market-day calendar before enabling any write.
4. Capture the source and output of the **same signal event**; bind security code, trade date and source record ID. Avoid treating scan:latest as a permanent immutable record.
5. After five *actual exchange trading sessions*, attach independently sourced licensed outcome evidence with its own timestamp, price convention and record ID. Never derive five sessions as five calendar days.
6. Run forward evidence gate, holdout review and minimum-sample checks offline first. Never update AI POWER, live signals, notifications or rankings from unverified evidence.
7. Deploy only after a separate review and explicit authorization. This PR remains Draft and SHADOW-only.

## Legacy policy
- 425 BB and 313 technical rows are historical descriptive data, not 738 proven forward predictions.
- Five BB rows have nonstandard development fixture codes; exclude from market research.
- Existing 733 valid-code rows can be used for descriptive feature distributions but cannot prove future outcomes.
- Technical signal raw_ai_power_snapshot was null in the examined 313 rows; do not impute or manufacture it.

## Outstanding evidence
- Licensed provider and terms for prospective bars and outcomes.
- Independently verifiable generation-time source and immutable retention design.
- Exchange-calendar validation and five-session evidence.
- Dev-only end-to-end capture and replay test with no production credentials.
