# Dual Surge licensed OHLCV offline replay — instructions

This is a **manual, offline, read-only** entry point for the 24 recovered diagnostic events. It does not request data from J-Quants, write Supabase, update the production app, deploy, or send notifications.

## Required snapshot (NOT YET AVAILABLE)

Obtain a lawful, licensed historical daily OHLCV export through an authorized method. The source file is not in this repository or the five recovered diagnostic attachments.

The JSON object must have these fields:
- `source`: `"JQUANTS_V2"`
- `snapshotId`: a nonempty immutable source identifier (ideally a content digest)
- `licenseVerified`: `true` **only if permission has actually been verified**
- `asOfDate`: `"2026-10-23"`
- `providerRowsByCode`: mapping of four-digit stock codes to arrays of daily records, with `Code`, `Date`, `O`, `H`, `L`, `C`, `Vo`, `AdjFactor`. Numeric fields must be numbers, not strings. Include enough sessions before and after the signal dates up to the cutoff.

Never set `licenseVerified` to true without confirming applicable terms. Do not commit private provider exports or credentials.

## Offline command

```sh
node scripts/dual-surge-offline-replay.mjs /secure/local/licensed-ohlcv.json > /secure/local/dual-surge-replay-report.json
```

Exit 0 means all 24 event-level diagnostic outcomes matched. Exit 1 means at least one mismatch. Exit 2 means missing inputs, malformed provenance, or invalid data. The report is diagnostic only; no production approval is implied.

## CI verification

GitHub Actions workflow `Dual Surge Research Tests` is configured on the isolated branch and draft PR #212. Confirm a real run on the Actions page and its conclusion. Vercel checks are not a substitute for GitHub Actions.

## Current status

As of 2026-10-25, no authorized raw snapshot is available, and no passing GitHub Actions run has been observed. The script has been committed but **not executed against real licensed rows**. STEP 140 remains incomplete.
