# MA75 rising-breakout forward evidence plan — frozen 2026-11-01

**Status: RESEARCH ONLY; no live signal, recommendation, ranking, trade, or automatic notification.**
Proposed on the 2026-11-01 research branch before the first eligible post-freeze
trading date. This is a protocol, **not evidence that real-time capture is working**.

## Basis for continuing a narrowly scoped hypothesis

The owner-local 122-session (2026-05-01 through 2026-10-30) J-Quants V2
retrospective examined 912 complete-history stocks from a frozen set of 953.
The other 41 have incomplete histories (242 missing stock-date provider rows,
38 stock-date corporate-action review entries).

| Historical condition | All signals | Settled at day 5 | Win rate | Average 5-session return with assumed 0.1% per side |
| --- | ---: | ---: | ---: | ---: |
| Any MA75 close breakout | 1162 | 1029 | 43.63% | -0.4586% |
| Rising MA75 at breakout close | 808 | 717 | 47.84% | -0.0062% |
| Breakout-day volume >= 1.5x prior 20 | 179 | 146 | 40.41% | -1.3127% |
| Both rising MA75 and high volume | 116 | 94 | 44.68% | -0.6896% |

For rising MA75, an owner-local robustness pass recorded a
**+0.0153% completed signal-date-equal-weighted mean**, and a **+0.0277%
earliest per-code non-overlapping 5-session mean** across 582 completed
cases. Both are economically near zero and very vulnerable to modest
unmodelled trading friction, bad fills and sample-selection bias.
The original baseline net return assumes **0.1% entry and 0.1% exit
friction**. The standalone offline audit now reports additional symmetric
round-trip friction of 0, 0.10, 0.20 and 0.40 percentage points; the
incremental scenarios do not represent measured fees.

There is **no verified profitability** and **no independent post-freeze
outcome evidence**.

## Fixed narrow hypothesis for forward observation

1. Frozen stock list is the original 953-symbol 2026-10-30 cohort, with no
   replacement of missing symbols, no hindsight deletion and no re-ranking.
   The first eligible post-freeze signal date is **2026-11-02**.
2. Signal arises only **after a completed trading day** and both a trustworthy
   signal-generation timestamp and end-of-day source timestamp are recorded.
   Neither a future bar nor the following day's open may enter signal
   classification. If data timing, entitlement, capture chain or OHLCV
   verification fails, record **UNKNOWN / NOT EVALUABLE**, not a buy.
3. The research candidate is **close crossing above that day's SMA75** after
   prior day's close was at/below prior-day SMA75, **AND SMA75 rising**
   relative to the previous day. Compute both averages exclusively from
   completed daily history, and reject corporate-action discontinuities until
   verified. The previously tested volume >=1.5x filter is *not* a required
   candidate feature.
4. Hypothetical entry is **following verified trading session's open**, with
   exit at **close of the fifth verified trading session after the signal**.
   Baseline simulated friction is 0.1% each side; publish sensitivity to
   *extra* round-trip friction. No claim is made that market-on-open could
   actually fill at the quoted price.
5. Record all candidates and their reasons, including missing or pending
   forward outcomes. Compare with **all MA75 breakouts** on the same
   authentic forward dates, while maintaining date-wide market exposure,
   stock overlap, distinct symbols, liquidity and market regime diagnostics.
   Report settled/pending/quarantined separately and do not infer a winning
   result by excluding inconvenient dates.
6. Forward evidence must include genuinely independently captured and
   timestamped original observations *after the freeze*, confirmed
   corporate-action policy, realistic taxes/fees/slippage, chronological
   train/evaluation boundaries, non-overlap/date clustering tests and
   sufficient multiple regimes/dates. A single week's returns, even if
   positive, are **insufficient**. A five-session outcome cannot be
   completed when the necessary trading dates have not occurred.
7. **Promotion gate remains closed**: no AI POWER, notifications, ranking,
   broker actions, production DB changes, scheduled fetching, Vercel
   deployments or new subscriptions without separate authorization and
   valid independent evidence. No automated job is enabled by this plan.

## Additional-cost offline diagnostic, no J-Quants key

Run from the original research repo/worktree after updating the draft branch:

```powershell
git switch research/ma75-breakout-retest-shadow-20261031
if ($LASTEXITCODE -ne 0) { throw "研究ブランチの切替に失敗" }
git pull --ff-only
if ($LASTEXITCODE -ne 0) { throw "研究ブランチの更新に失敗" }

$r = node .\scripts\research\ma75-local-coverage-audit.mjs | ConvertFrom-Json
if ($LASTEXITCODE -ne 0) { throw "オフライン監査に失敗" }

$c = $r.historicalCompleteCaseDiagnostic.precloseConditions.conditions |
    Where-Object { $_.condition -eq "RISING_MA75_AT_CLOSE" }
$c.dependenceStressCheck.incrementalExecutionFrictionSensitivity |
    ForEach-Object {
        [PSCustomObject]@{
            ExtraRoundTripPercent = $_.additionalRoundTripPercent
            NoOverlapN = $_.earliestNonOverlappingPerCode.completed
            NoOverlapMean5 = $_.earliestNonOverlappingPerCode.meanNetReturn5Percent
            NoOverlapWinRate = $_.earliestNonOverlappingPerCode.winRatePercent
            DateEqualMean5 = $_.allBreakouts.dateEqualWeightedMeanNetReturn5Percent
        }
    } | Format-Table -AutoSize
```

The command reads only the local ignored `research-private` cache and
prints derived summary statistics; no external service or secret is needed.
Do not upload original J-Quants daily JSON, API keys or `.env.local`.


## Readiness and explicit manual capture bridge (2026-11-01)

Existing pure MA75 forward-manifest, timestamp audit, replay, five-session settlement,
and independent review gates remain in place. Nothing below schedules a job or
produces a buy, sell, score, recommendation or forward win rate. No paid minute
data are required for this daily-bar-only shadow.

A separate owner-local one-day bridge is now available:
- `scripts/research/ma75-forward-local-one-day.mjs` — date-only, original
  full-market J-Quants V2 capture, dry-run without network by default.
- `scripts/research/ma75-run-forward-day-local.ps1` — Windows runner with
  secure hidden input for an **already active** V2 key only when expressly
  passed `-Execute`. It restores prior process-level key/consent values.
- Destination `research-private/ma75-forward-YYYY-MM-DD-jquants-daily.json`
  is a **new, distinct filename**, excluded from Git. Existing file
  overwrite is forbidden; no historical day is replaced.
- Exposes no full-market prices in the terminal. A stored original day is
  not source-verified, nor a validated forward signal. Historical archive
  remains a separate provenance tier.
- The 122-day offline archive audit also includes
  `preFreeze75SessionWarmup`: exactly the most recent 75 archived trading
  date rows, counts of full-window clean prior history versus gaps, **with
  explicit flags that no post-freeze signal or provenance verification has
  occurred**. This is an input readiness inventory, not a win rate.

**First eligible signal date: Monday 2026-11-02 (JST).** On **2026-11-01**
the first-date dry-run is the only supported invocation, and should report
`DRY_RUN_SESSION_NOT_YET_PUBLISHED`, network requests 0, writes 0:

```powershell
git switch research/ma75-breakout-retest-shadow-20261031
if ($LASTEXITCODE -ne 0) { throw "research branch missing" }
git pull --ff-only
if ($LASTEXITCODE -ne 0) { throw "git update failed" }
.\scripts\research\ma75-run-forward-day-local.ps1 -Date 2026-11-02
$r = node .\scripts\research\ma75-local-coverage-audit.mjs | ConvertFrom-Json
if ($LASTEXITCODE -ne 0) { throw "warmup audit failed" }
$r.preFreeze75SessionWarmup | Format-List
```

**Only on or after Nov 2, 2026 at 16:30 Japan time, IF the licensed V2
daily source is really available and the owner explicitly wants one manual
provider read**, run from the research worktree:

```powershell
.\scripts\research\ma75-run-forward-day-local.ps1 -Date 2026-11-02 -Execute
```

The wrapper checks the time threshold *before asking for a key*; this
threshold is a conservative eligibility guard, **not proof the provider has
published data, not permission to use the data for external redistribution,
and not proof of a next-open executable signal**. Manual owner-run results
must still be independently checked for source rights, live timestamp
provenance, provider changes, corporate actions, calendar and fills before
any forward study outcome can be certified. No automatic daily polling or
future capture is promised.


## November 2 owner-local provider day: captured, not tradeable

The owner reported a successful **2026-11-02** manual opt-in original V2 daily source capture (first frozen-eligible date). PowerShell returned:

- Status: `ORIGINAL_FORWARD_DAY_CAPTURED_PRIVATE`
- Original J-Quants all-listed rows: **4,445**, pages **1**
- Frozen cohort projected rows: **953**
- Private source filename: `research-private/ma75-forward-2026-11-02-jquants-daily.json`
- Provider publication/authenticity and rights independently verified: **no**
- Next-open source timing independently audited: **no**
- Forward signal generated, five-session outcomes, notification authorization: **no**

The existing prefreeze 75-session archived warmup (July 10 to October 30)
contained 925 fully archived 75-bar histories out of 953 fixed codes,
with 28 incomplete histories; 108 missing provider code-date rows and
26 corporate-action review code-date rows. These 134 unavailable code-day
entries do not imply 134 distinct codes.

### First-date shadow-only technical classification (new)

The offline CLI uses only the **already saved** 122-session private archive
and its **separately named** 2026-11-02 post-freeze date file.
It audits all 122 original archived dates for integrity, then builds
75 historical trading sessions + the captured November 2 close for each
original frozen code. This detects breakout/retest-type *technical
classification inputs only*, not settled outcomes or trade suggestions.

```powershell
cd C:\Users\neomo\signal-x-minute-research
git switch research/ma75-breakout-retest-shadow-20261031
if ($LASTEXITCODE -ne 0) { throw "branch switch failed" }
git pull --ff-only
if ($LASTEXITCODE -ne 0) { throw "branch update failed" }

$r = node .\scripts\research\ma75-local-first-forward-review.mjs | ConvertFrom-Json
if ($LASTEXITCODE -ne 0) { throw "offline first-date audit failed" }

$r | Select-Object requestedSignalDate,fixedFrozenCodes,
    codesWithCompletePrior75,blockedPrior75,
    blockedCurrentDayAmongCompletePrior75,
    quarantinedPriceDiscontinuity,analyzableCodeCount,
    allBreakoutShadowCount,risingMa75BreakoutShadowCount |
    Format-List

$r.shadowPatterns | Select-Object code,sma75Rising,historicalVolumeRatio |
    Format-Table -AutoSize
```

There is **no API key prompt, network request, daily recapture, new
file output, production change, auto-monitoring, real execution or
provider-cost change**. The raw licensed pages remain local; the
derived console output contains research codes/aggregate statuses only.
If the original forward capture or any cached historical date is missing
or tampered with, the entire local audit fails closed. Market information
recorded late cannot retrospectively become a valid next-open signal:
the `shadowPatterns` field explicitly withholds point-in-time provider
authentication, official session-calendar verification, source rights,
corporate-action certification and outcome rates.

One November 2 observation day cannot establish reproducibility or
profitability; the predeclared MA75 strategy retains **NO PRODUCTION
PROMOTION**. The next calendar trading session after November 2 must
be validated against an official source before a hypothetical entry
could be simulated; the CLI does not infer it or attempt to fill it.


## 2026-11-02 first real shadow cohort and one-time local fingerprint

Owner completed an offline read of **Nov 2, 2026** source: fixed frozen
953 codes; **925** with complete 75-session warmup, **28** missing warmup,
**zero** additional current-date missing rows among the 925,
**one** large price discontinuity quarantined, **924** analyzable.
**27** MA75 close breakouts on Nov 2, of which **22** had SMA75 rising,
and **5** breakouts did not have SMA75 rising. This is a count of
`CLOSE_TIME_SHADOW_PATTERN_ONLY` records, **not an audited actionable
signal**, trade recommendation, profit rate or evidence of a reliable edge.
The 22 rising cases must not be used without also retaining the
27-breakout original control denominator.

**Next cash market trading session is 2026-11-04 (Wednesday).**
Japan Exchange Group lists Nov 3 (Tuesday) as a market holiday for
Culture Day: https://www.jpx.co.jp/corporate/about-jpx/calendar/
If the market follows its published schedule, subsequent five-day
hypothetical close exits after Nov 2 signals are Nov 10 (Nov 4, 5, 6,
9, 10). Neither future opening prices nor outcomes can be evaluated as
of Nov 2.

### Offline capture of a fixed first-day research baseline

The `ma75FirstDayResearchFreeze` pure module now retains **all**
breakouts, the rising subset, and every excluded/quarantined code; there
is no 22-only winners-chosen denominator. The optional owner-local
`ma75-freeze-first-forward-day.mjs` CLI hashes the one Nov 2
original saved file AND each of the 75 pre-freeze daily sources, while
retaining no original licensed OHLCV in the derived output.

From the branch and worktree that already contain the private captures:

```powershell
git switch research/ma75-breakout-retest-shadow-20261031
if ($LASTEXITCODE -ne 0) { throw "研究ブランチの切替失敗" }
git pull --ff-only
if ($LASTEXITCODE -ne 0) { throw "研究ブランチの更新失敗" }

# No writes; preview expected 27 breakout patterns, 22 rising
node .\scripts\research\ma75-freeze-first-forward-day.mjs
if ($LASTEXITCODE -ne 0) { throw "研究プレビュー失敗" }

# Explicit opt-in to write ONE derived manifest, once, before 2026-11-04 09:00 JST
node .\scripts\research\ma75-freeze-first-forward-day.mjs --freeze
if ($LASTEXITCODE -ne 0) { throw "研究用凍結に失敗" }

# Read-only verification on this or a later day
node .\scripts\research\ma75-freeze-first-forward-day.mjs --verify
if ($LASTEXITCODE -ne 0) { throw "凍結データの照合失敗" }
```

The destination is exactly
`research-private/ma75-first-forward-2026-11-02-cohort-freeze.json`.
It uses `flag: wx` (exclusive create); a second freeze refuses to
overwrite the first. The manifest contains only derived code-level
observations, exclusion reasons, local timestamps and SHA256 fingerprints,
not original licensed stock price pages or API keys.

A local system clock / SHA256 manifest is **not independent proof**
that original provider prices were truly published or available before
the next opening bell, and does not certify license rights, market
session authenticity, corporate actions, fees, fill quality or positive
expected returns. Therefore no signal promotion occurs even if this
manual freeze is successful.

If a freeze is attempted **after** 2026-11-04 09:00 JST, the CLI
refuses a retroactive pre-open freeze instead of backdating it.
`--verify` can continue checking a previously created file later.
No new J-Quants provider calls, scheduled jobs, Supabase mutations,
production deployments, broker actions or alerts are initiated by this
workflow.
