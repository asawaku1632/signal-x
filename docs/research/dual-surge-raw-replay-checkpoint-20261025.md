# Raw OHLCV replay implementation checkpoint — 2026-10-25

## Added
- Pure `replayDiagnosticEvents` function in `app/lib/research/dualSurgeRawReplay.mjs`, accepting only caller-supplied OHLCV and the event reference.
- Computes five-session signal-close to future-close outcomes using the existing strict provider-row normalization and historical outcome functions.
- Compares identity, maturity status and returns (0.001 percentage-point tolerance), reports missing provider stock, missing signal session and discrepancies.
- Rejects duplicate event identities and invalid as-of dates; excludes rows after the as-of date.
- Nine synthetic tests added to `tests/research/dualSurgeRawReplay.test.mjs` and wired into the GitHub Actions research workflow.

## Evidence status
- **155 test definitions** now recorded (146 + 9). Full GitHub Actions passing result **not verified**.
- Recovered diagnostic reference contains 24 events and has passed source-file hash / event count checks.
- **No raw licensed J-Quants OHLCV snapshot has been provided**. Accordingly this module has not been run against the 24 real events. Do not claim independent replay complete.
- Provider research license remains unverified. No automated fetch, database writes, cron, notifications, production merge or deployment were performed.
- STEP 140 remains incomplete until actual CI pass and raw-bar reconciliation evidence are available.
