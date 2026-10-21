# Independent daily-bar evidence: first real-data pilot gate (2026-10-21)

## Scope
Owner-only, offline, read-only research for sample securities 3996, 3762 and 4493. No production data writes, trading instructions, notification integration or claims of verified win/recovery rates.

## External data prerequisite
Before enabling a live J-Quants fetch, confirm the actual account's plan, API version, permitted historical dates, redistribution rights and the documented response schema using official J-Quants documentation. Do not put API keys in GitHub, issues, logs or browser code. Configure any credentials only through an approved protected secret store after authorization.

## Data evidence checklist
1. Record provider identity, endpoint, schema version, acquisition UTC timestamp and source date.
2. Retain the unmodified provider code and date, and record the exact mapping to SIGNALX's four-digit security code. Reject ambiguous five-digit codes.
3. Record raw close and adjusted close separately; verify the provider's adjustment methodology and any stock split/corporate action around the comparison date.
4. Independently validate that the stored SIGNALX baseline is the activation-time observation, not a trade fill or official exchange close. Document timezone and timestamp precision.
5. Never set samePriceBasis or corporateActionReviewed to true automatically based only on a field name. Require manual evidence review.
6. Compare no more than 20 rows for the fixed three-security pilot; reject duplicates, missing adjusted prices and mismatched dates.
7. Publish only coverage, discrepancy and reason counts until both baseline and future prices have independent verification. Do not turn offline comparison into a verified forward return.

## Current implementation
- `independentPriceComparison.mjs`: source comparison and fail-closed verification flags.
- `independentPriceInputAdapter.mjs`: strict JSON schema and byte limit.
- `jQuantsDailyBarOfflineAdapter.mjs`: accepts manually supplied J-Quants-like bar fields; does **not** connect to J-Quants or authenticate evidence.
- `scripts/review-independent-price-evidence.mjs`: local JSON file comparison summary only, without printing individual prices.

## Go/no-go
**NO-GO for live provider fetch and verified return publication.** The API schema, access entitlement and independently verified activation baseline are not yet established. CI and preview build status must be checked independently; a deployed preview is not proof of data validity.
