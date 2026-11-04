# MA75 2026-11-04 first-session original-source review — SHADOW_NOT_APPROVED

**No real orders, live buy signals, future outcomes, app/DB changes, or automated provider reads.**

The 2026-11-02 original frozen candidate universe is immutable:
- Fixed 953 listed codes; complete 75-session historic warmup 925;
  analyzable 924, missing 28, one discontinuity excluded.
- All Nov 2 MA75 closing crossovers: 27.
- MA75 rising crossovers: 22 of the 27.
- Newly audited upper-wick>=35% / volume>=1.5x subset: 3 of the 27,
  all in the 22, stock codes 1878, 7172, 9832.
- Saved, owner-local original cohort checksum:
  1ba1aee5ac05b2c0fd114d3cabe5463bde4409b203544722cf03c04fc0a6612b.
  DO NOT re-run --freeze and DO NOT overwrite, delete or reupload originals.

## Purpose of the new script

The owner-only, offline, read-only script
scripts/research/ma75-first-session-local.mjs first replays the complete
Nov 2 frozen 27/22/3 comparison and verifies source hashes using the
existing integration. It can then consume precisely one **already saved**
Nov 4 original all-listed date file under
research-private/ma75-forward-2026-11-04-jquants-daily.json.

If the outcome date file does NOT exist, it returns **27 PENDING**
original codes, including the 3 compound codes, with all simulated
returns null. It does not trigger any network call or silently reuse
an older date. If the file exists, it validates pagination, original
trade date, frozen 953 projection and original local receipt chronology,
then classifies the 27 original codes without reselecting them.
A missing/no-trade row is PENDING; corporate action, invalid OHLCV or
flat price bars are QUARANTINED, not treated as zero-return, as a
profit/loss or as a reason to drop the original code. The script also
reloads the hash-verified original Nov 2 closing bar for each of the 27;
opening or closing price gaps exceeding 45% relative to that close
are QUARANTINED as unverified possible corporate actions or bad data.
The gap check is a conservative quality screen, not a real volatility rule.

For each usable Nov 4 original daily bar:
- Hypothetical entry: 2026-11-04 OPEN, with +0.1% adverse friction.
- Hypothetical +1 session exit: the **same Nov 4 CLOSE**, with -0.1%
  adverse friction. This is NOT a broker fill claim or a strategy
  selected before the Nov 4 open.
- Net modeled return: 100 * (close * 0.999 / (open * 1.001) - 1).
- 100-share modeled net gain in yen:
  100 * (close * 0.999 - open * 1.001).
- Adverse low relative to entry all-in cost:
  100 * (low / (open * 1.001) - 1);
  this is only one day and NOT peak-to-trough drawdown or stop fill.
- 100-share modeled purchase cost and example number of 100-share lots
  within the predefined ¥100,000–¥500,000 research budget.
- Group descriptive statistics separately for all 27, rising 22,
  and the 3 compound candidates. Partial-data denominators remain
  explicit, with missing and quarantined counts retained.
- 3-session date 2026-11-06 and 5-session date 2026-11-10 are future
  follow-up dates; returns stay null until their own original data
  and the intermediate session-calendar evidence are available.
  No third- or fifth-day result is asserted by this script.

**Important provenance warning:** Original provider page receipt times
are recorded by the local client, not independently authenticated.
A Nov 4 bar acquired after close does NOT prove that the entry
at Nov 4 opening auction was tradeable or that the strategy had
known the input in time. Real order fill, spreads, taxes,
corporate-action completeness, exchange-calendar authenticity
and independent post-freeze validation remain unverified.

## PowerShell runbook — manually authorized existing API only

All actions run in the Windows research worktree. No background job.

~~~powershell
cd C:\Users\neomo\signal-x-minute-research
git switch research/ma75-breakout-retest-shadow-20261031
if ($LASTEXITCODE -ne 0) { throw "研究ブランチの確認失敗" }
git pull --ff-only
if ($LASTEXITCODE -ne 0) { throw "Git更新失敗" }

# Confirm the 2026-11-02 original 76-source immutable reference.
node .\scripts\research\ma75-freeze-first-forward-day.mjs --verify
if ($LASTEXITCODE -ne 0) { throw "旧コホート整合性監査失敗" }

# DRY-RUN does not call the data provider, does not write a source file.
$p = .\scripts\research\ma75-run-forward-day-local.ps1 -Date 2026-11-04 |
  ConvertFrom-Json
if ($LASTEXITCODE -ne 0) { throw "11月4日事前確認失敗" }
$p | Select-Object status,alreadyStored,date,output | Format-List

# If alreadyStored=True, do not call -Execute: avoid duplicate reads.
# If False, manually authorize this ONE single-day read. A floor at
# 16:30 JST is NOT proof J-Quants has actually published the date.
if ($p.alreadyStored -ne $true) {
  .\scripts\research\ma75-run-forward-day-local.ps1 -Date 2026-11-04 -Execute
  if ($LASTEXITCODE -ne 0) { throw "J-Quantsの11月4日データ未取得または保存失敗" }
}

# Read-only first-session simulated 27/22/3 outcome:
$r = $null
$r = node .\scripts\research\ma75-first-session-local.mjs | ConvertFrom-Json
if ($LASTEXITCODE -ne 0) { throw "初日研究監査失敗" }
$r | Select-Object status,firstSessionDate,originalCodesRetained,
  risingCodesRetained,compoundCodesRetained,outcomeOriginalPresent,
  independentValidatedForwardOutcomes | Format-List
$r.groups | Format-List
$r.byFrozenCode | Where-Object { $_.compoundWickVolume -eq $true } |
  Select-Object code,status,return1Percent,profitYen100,
    firstSessionAdverseLowPercent,modeledEntryCostYen100 |
  Format-Table -AutoSize
~~~

The API token, if requested, is entered in the existing PowerShell
hidden prompt. Never paste API keys, original vendor JSON pages, or
unlicensed OHLCV into a public issue/PR. No automatic capture is added,
no J-Quants subscription changed, no extra scheduled cloud read.

## Interpretation rule

Even a good first-session average is ONE completed session from ONE
signal date. It cannot establish stable probability, expected net
profit or repeatability. This is an offline descriptive research result.
Preserve the fixed 27 denominator with the 22 and 3 defined as
nested comparison groups, pending counts and quarantines.
Promotion remains **SHADOW_NOT_APPROVED** and requires a separate
prospective independent experiment, quality/rights verification and
an explicit owner authorization before any production or notification.
