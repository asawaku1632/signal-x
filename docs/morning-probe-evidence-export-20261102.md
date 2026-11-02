# Morning probe evidence export and offline daily comparison — 2026-11-02

## Goal and safety
- Existing 2026-10-21 to 2026-11-02 frozen morning records have **0/45 usable 09:08 decisions**. Some 5-minute bars were present only in the independent later archive. We cannot turn later data into a past buy decision.
- Research remains **owner-only, manual and preview-only**, with no database mutation, real orders, notifications, extra paid feeds, server cron or automatic polling.
- Main goal is **availability evidence**, not stock return statistics or algorithmic win rate.

## One-click Android / desktop use
- On a supported next trading day (Wednesday **2026-11-04** after the 11/3 JPX holiday), open `/admin/night-morning-watch` as owner.
- During **09:15:00–09:34:59 Japan time**, explicitly press **「5分足を確認して証拠JSONを保存」**. The button makes an owner-authenticated, same-origin POST call to `/api/admin/morning-probe-shadow`; a mere page visit triggers zero Yahoo requests from this new route.
- The route reads the previously night-frozen at-most-five symbols and queries existing Yahoo five-minute charts (at most five calls). It returns `archive` with server-side receipt timestamp per symbol, batch start/end timestamps, prior freeze time, missing completed bars, upstream failure codes, and indicative reference slots.
- The browser initiates download `signalx-morning-probe-YYYY-MM-DD-HHMM.json`. On Android, check the downloads folder. The browser reports when a download was requested, **not** that storage completed; user can review the file.
- If the time window, owner, DB or chart query is unavailable, nothing is fabricated and the button reports the failure. Repeating the same slot generates an additional response, but does not increase unique observation count.
- Do not log or upload private login cookies, API credentials or your complete browser/network traces.

## Verifiable JSON bundle
- Each export contains `evidence` and `checksum` generated together by the server. SHA-256 detects accidental modifications. **It is not a cryptographic signature, authenticity guarantee, or official JPX confirmation**; anyone able to change both content and checksum can rewrite them.
- The archive checks trade date, original frozen cohort, each symbol's request/receipt time within one five-minute bucket, valid response status, and that completed candles were closed by receipt.
- A valid observed bar cannot be reused as a historical executed entry: the earliest research **reference** bar start is strictly after receipt. A future bar is not automatically available/executable when that slot begins.
- Missing values and upstream HTTP failures are recorded as evidence of **nonavailability** rather than dropped from denominators. Any duplicate symbol+date+slot appearing in several files is ambiguous and is removed from computed availability rates.
- **No evidence file is created server-side; no database table is created or modified.** A downloaded JSON file is the only persistent output from the new workflow.

## Offline validation and multi-day report
Run only on files downloaded during actual market sessions (not the demonstration fixtures):

```sh
node scripts/research/report-morning-probe-archives.mjs data/one.json data/two.json
```

Reports valid/invalid files, duplicated observations, and for each time slot the number of recorded symbols, days, availability, missing completed candles, upstream errors, and the available percentage. Empty or incomplete archives never become a zero-loss or a 100%-win backtest.

If you only have an Android phone, you can upload the downloaded JSON exports to ChatGPT for the same read-only analysis. The current draft cannot automatically export or aggregate days in production.

## Limitations / nonactivation
1. The next market's actual Yahoo response times have **not yet been observed**; local fixture tests are **not** trading results.
2. A 09:15 completed bar may be delayed or revised by the provider; saved receipt time is only when our server read that response. The analysis still excludes future/OHLC bars from any earlier decision.
3. A five-minute bar OPEN, even after the observation, is an *indicative* reference and not a verified executable bid/ask. Slippage, liquidity, business news, 1/3/5-day outcome and drawdown research must remain separate.
4. No cron, database migration, material contract, or production AI/notification changes are authorized by this Draft. A fully automatic persistent journal would require explicit owner approval, target DATABASE_URL verification, rate-limit budgets and independent prospective audit.

## Implementation inventory
- `app/lib/research/morningProbeArchive.mjs` — sealed archive, checksum, validation and offline unique symbol-day-slot aggregation.
- `app/api/admin/morning-probe-shadow/route.ts` — server stamps source and frozen-cohort evidence and attaches an archive.
- `app/admin/night-morning-watch/MorningProbeDownload.tsx` — user-initiated download button; no page-load fetch, no server write.
- `scripts/research/report-morning-probe-archives.mjs` — local aggregate on saved files, no network.
- `scripts/research/morning-probe-archive.test.mjs` — 20 archive/provenance/Android UI regression tests included in `npm run test:next-session` build gate.

### Request safety
The route accepts only an owner-authenticated same-origin **POST**. Ordinary URL navigation and GET prefetch cannot cause new Yahoo requests. The UI does not make any request until the explicit button click.
