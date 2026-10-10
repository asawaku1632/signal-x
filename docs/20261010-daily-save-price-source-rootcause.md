# 2026-10-05–09: why 15:35 learning prices diverge from later Yahoo 1D bars

## Production findings verified READ ONLY on 2026-10-10

| Trading day | Cron actually received (JST) | Scheduled (JST) | Recorded daily data | Tested Yahoo 1D agreement |
| --- | --- | --- | --- | --- |
| 10/05 | 16:14:19 | 15:35 | 953 stocks | 5/5 |
| 10/06 | 16:14:19 | 15:35 | 953 stocks | 5/5 |
| 10/07 | 16:14:19 | 15:35 | 953 stocks | 5/5 |
| 10/08 | 15:35:14 | 15:35 | 953 stocks | 0/5 |
| 10/09 | 15:35:14 | 15:35 | 953 stocks | 3/45 |

*Saved row times* were around 16:14:36–41 on 10/05–07 and 15:35:35 on 10/08–09. The older runs were delayed by 2,359 seconds (39m19s) according to `cron_run_logs.details.delaySeconds`. This is **scheduler arrival time**, not individual quote time.

Code path: `GET /api/learning/save-daily` → `fetch(/api/scan?limit=1000)` → `getLatestScanSnapshot / refreshScanSnapshot` → `runScan` → `analyzeStock` → Yahoo finance chart `1d/5m` (preferred if fetch works) or `3mo/1d` (fallback) → `saveDailyStocks` (`ON CONFLICT DO NOTHING`).

Both 10/05–07 and 10/08–09 had `scanResponse.bodyPreview` beginning with `cached:true`; that bit **alone does not indicate cache age**. The source could have been refreshed just before saving, or be older. The logged response preview is truncated at 500 chars and does NOT contain original snapshot timestamp or individual bar time. Historical `scan:latest` row is overwritten when refreshed, so the original bar timestamps for 10/08–09 are missing.

### 9984 supporting candle evidence

An **independently captured and later cached** `chart:9984:5m` snapshot from 2026-10-10 05:12 JST includes:
- 2026-10-09 15:15 JST 5-minute candle close **¥5,838** (exactly the 15:35 saved baseline);
- 2026-10-09 15:30 JST 5-minute candle close **¥5,803** (matches the later Yahoo daily reference).
- On 2026-10-08, candle closes at **15:05 and 15:15 were ¥6,059**, matching the learning baseline, while later Yahoo daily reference is ¥6,040.

This is **strong evidence of an earlier intraday quote or partially updated data** on the 15:35 runs. It does not prove that the actual `/api/scan` response used the 15:15 candle: the daily-price table did not store the candle timestamp and prices may coincide at multiple times. It also does not prove why Yahoo exposed the earlier value (upstream delay, refresh/caching lag, data revision, etc.).

### Why not automatically repair prior data?

The old prices are part of the original AI-decision observations and have already been used by subsequent outcome comparisons. Quietly overwriting them would rewrite model evidence and risks corrupting research. The private later Yahoo 1D prices are deliberately separated in `daily_learning_price_reference_audits`.

### Phase 1 fix: forward-only, passive provenance (this PR)

- Add the exact Yahoo candle timestamp from `fetchYahooChart` to scan stock metadata, without changing price, AI POWER or ranking.
- Collect pure metadata during `save-daily`: snapshot `updatedAt`, `cacheAge`, `cached`, source counts, top last-candle JST clocks, missing/mismatched-date bars, number of bars older than 10 minutes, and five fixed audit examples.
- Persist this diagnostic inside existing `cron_run_logs.details.priceSourceAudit` for `SCAN_FINISHED` and `SAVE_SUCCESS` (and terminal run summary). NO new SQL table, cron, Yahoo calls, notifications, market-data permissions, model training, price replacement or buy/sell changes.
- Interpret `barsMoreThan10MinOld` as a **research clue** only. Yahoo's bar clock need not equal quote receipt or official exchange close. A source timestamp on a 5-minute interval can refer to an earlier range.

### Next-stage decision (separate approval, not in this PR)

After at least one full market day of new provenance, compare 15:35 stored candle clocks with the later day-end reference price, distinguish (a) stale snapshot, (b) fresh scan with stale/latest incomplete bar, and (c) vendor adjustment. Only then decide whether to add a delayed/verified-price parallel snapshot or a genuinely licensed EOD feed. Never change the original AI snapshot or live trade/notification behavior without separately reviewing impacts.
