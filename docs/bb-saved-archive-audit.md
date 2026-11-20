# BB_CANDLE_V1 local archive coverage inventory (research only)

A read-only, no-network inventory identifies which *existing private* J-Quants captures can be examined as exact common date cohorts against a verified TOPIX benchmark, without re-capturing paid data.

```powershell
node --test tests/bbSavedArchivesAudit.test.mjs tests/bbMarketRegimeV1.test.mjs
if ($LASTEXITCODE -eq 0) {
  node .\scripts\research\audit-bb-saved-archives.mjs ".\.private-research\bb-candle-topix-20260925-20261104.json" "C:\Users\neomo\signal-x-four-pattern\.private-research" "C:\Users\neomo\signal-x-earnings-research\.private-research"
}
```

This prints only dates, stock codes and basenames, no minute prices or key material. It excludes duplicates by stock code+full date signature, groups *exactly* matching trading-date lists, and checks the previous 5 benchmark trading sessions for each date. Missing benchmark history leaves the candidate not ready. A cohort containing only one or two days is not sufficient to demonstrate positive expected profit.

**Important limitations:** this is a metadata-only audit. It does *not* certify J-Quants minute completeness, consistency with daily OHLCV, pattern detection, a strict forward performance sample, or actual availability at signal time. Existing replay performs these further checks and will refuse overlaps/mismatched cohorts. Never sum cohort outcomes where the same stock/date can appear more than once. The initial 3-stock 20-session cohort yielded only 9 BUY observations, 6 matured after five sessions.

No production change, external requests, storage mutation, notification or trade execution. Saved files must stay out of Git.
