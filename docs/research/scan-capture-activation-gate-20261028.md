# Research Scan capture: activation gate (2026-10-28)

Status: **NOT ACTIVATED**. Research dev DB row count was zero at audit time.
Draft-only; do not deploy or merge as an automatic live integration.

## Confirmed
- `captureResearchDevScanExecution` captures start/end timestamps around an injected Scan function.
- `captureAndIngestResearchDevScan` requires explicit development capture and write flags and a development database host.
- PostgreSQL integration tests use isolated CI database and rollback. Their passing results are not live market observations.
- `scanSnapshot.ts` is a production-facing shared boundary; leave it untouched without explicit production authorization.
- Source fields in Scan include `latestBarTimestamp` and `dataSource`, but they do not independently prove feature availability or licensing.

## Blockers for actual research collection
1. No authorized, isolated **development-only** caller currently invokes real `runScan` with live provider access and passes its original execution result to the capture bridge.
2. Market-data provider permissions for persistent research storage and derived use must be verified separately. Do not equate `dataSource: intraday` with a license.
3. Developer runtime needs a verified development database connection, credentials kept in secret storage, and an authorized run boundary. Never put credentials in GitHub files or logs.
4. Preserve original capture timestamp at execution; historical snapshots cannot be relabeled as contemporary predictions.
5. Results stay `QUARANTINED` until independently timestamped feature lineage, legally usable source data, and forward outcomes for five completed JPX trading sessions are documented.

## Definition of done
- One genuinely generated development Scan is captured once, with original timestamps, complete scan diagnostics, and licensed source; no replay.
- Its dev-only insertion is confirmed by a read-only query returning one or more newly created `QUARANTINED` rows.
- A repeat with the same run ID creates no additional rows.
- The production database, AI POWER, and notifications remain unchanged.
- All test/CI results and any blocked conditions are recorded; zero actual rows is reported as zero, never as learning progress.

**Do not** auto-call production Scan from a research script, add a public write route, or use Yahoo data as independently verified research evidence.


## Provider terms review (2026-10-28)
Official Yahoo! Finance Japan guidance says mechanically acquiring listing data
(scraping) and unauthorized copying, reuse, redistribution or commercial use are
prohibited. Do not enable recurring Yahoo research capture merely because the
existing Scan engine can retrieve `intraday` and `daily_fallback` bars.
Source: https://support.yahoo-net.jp/SccFinance/s/article/H000011276

JPX J-Quants offers formally documented daily OHLC datasets:
https://jpx-jquants.com/apidoc.html
However the Free plan delivers market data with a 12-week delay. It cannot
supply a same-week independent five-session outcome check. The terms also
restrict redistribution of raw data and repeated provision of analysis derived
from the API to third parties. Review actual intended app distribution and
license permissions before enabling a provider integration.

**Immediate decision**: keep real-data ingestion disabled pending proof of
permitted automated collection, retention, derived research, and app distribution.
Do not purchase a paid plan or deploy integrations without user authorization.
An offline mock/integration test is not evidence of permission or a real sample.
