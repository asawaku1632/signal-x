# SIGNALX MA75 — next independent frozen signal-date experiment

**Research-only, SHADOW_NOT_APPROVED**, written and committed
**2026-11-10** BEFORE the future **2026-11-11** source bar.
This is a new date-specific experiment, NOT a reinterpretation of
the original 2026-11-02 27/22/3 cohort.

## Why this exists

The original Nov 2 MA75-close crossover study observed:
- 27 original crossings / 22 rising-SMA75 / 3 wick-volume;
- at five following trading sessions: all 27 +0.4501% mean,
  rising 22 +0.2978%, wick-volume 3 -1.3560%;
- budget-eligible original 22 +1.2998% mean, 13/22 positive,
  per 100 shares +¥1,896.62;
- rising AND budget 20 +0.4911% mean, 11/20 positive,
  per 100 shares -¥246.54;
- excluding code 2222 (+17.6368%) reduced budget 22 mean to
  ~+0.5218% and per-100 share mean to ~-¥186.25, showing
  considerable one-outlier dependency.

This retrospective history **motivates** the new protocol but
is NOT reused as an independent test sample. Reinterpreting
2026-11-02 codes as a freshly predicted 2026-11-11 signal would
be a look-ahead error.

## Predeclared 2026-11-11 rules

See the immutable-by-policy
\`docs/ma75-prospective-20261111-predeclared-policy.json\`.
The exact 953 codes are inherited from the original Oct 31
research universe; NOT falsely described as all TSE listings.
Exactly 75 previous completed source days will be read (69 archived
through Oct 30, and locally saved original daily pages for Nov
2/4/5/6/9/10). The Nov 11 new source page must be manually
captured, complete, licensed owner-local, and its timestamp must
pass the conservative 16:30 JST floor. A signal is the FIRST
Nov 11 closing crossover from previous close <= previous SMA75
to closing price > Nov 11 SMA75, with MA75 rising/non-rising
classified from Nov 11 vs previous SMA75. All actual new crossover
codes are retained even if they subsequently fall.

**Do not assume there are any Nov11 crossover candidates** before
reading the original completed Nov11 source. The candidate count
may be zero. No original J-Quants data is stored in GitHub.

The new candidate lock is DIFFERENT from the old immutable
\`ma75-first-forward-2026-11-02-cohort-freeze.json\` and must be
saved to a NEW private file:
\`research-private/ma75-2026-11-11-new-signal-lock.json\`.
This runner uses an exclusive \`wx\` write and will not overwrite
an existing new lock, the Nov 2 lock, source captures, or any
production database. Lock must be created **after Nov 11 16:30 JST**
and **before Nov 12 09:00 JST**; otherwise fail closed rather than
claim prospectively timed signals.

From Nov12 original opening prices, conditionally determine
whether some whole number of 100-share lots costs between
¥100,000 and ¥500,000 inclusive, including +0.1% adverse
purchase friction. This filter can NOT be known as of Nov11 close;
it is therefore an **entry-day contingent, hypothetical
budget-eligibility** comparison, not a pre-open signal.

The outcomes are PREDECLARED Nov12 close (+1 exchange session),
Nov16 close (+3 sessions; includes Nov13), and Nov18 close
(+5 sessions; includes Nov17). All intervening daily originals
must be separately captured; missing session => PENDING,
not estimated or skipped. Exit side incurs 0.1% adverse
friction; actual fills, exchange session timing, splits,
delisting, spreads, trading, external provider authenticity,
rights and taxes remain uncertified.

Compare 6 nested groups, WITHOUT omitting losers or relabelling
the original 27:
1. All newly frozen MA75 breakouts
2. Rising MA75 of new breakouts
3. Non-rising MA75 of new breakouts
4. Conditional budget-eligible breakouts
5. Conditional budget-eligible and rising
6. Conditional budget-eligible and non-rising

For each group/horizon: original-group sample size, measured,
pending and quarantined counts, median net return, mean net
return, simulated net P/L per 100 shares, positive rate and
**leave-largest-winner-out / leave-largest-loser-out** mean.
A low-n or one large stock MUST NOT be described as evidence
of a stable trading edge. Do NOT optimize an exit day after
seeing future results. Every signal DATE (not stock) counts
as one independent market-date observation for later
cross-date replication.

## 2026-11-10 — run the safe plan now (NO API or file writes)

~~~powershell
cd C:\Users\neomo\signal-x-minute-research
git switch research/ma75-breakout-retest-shadow-20261031
if ($LASTEXITCODE -ne 0) { throw "研究ブランチ切替失敗" }
git pull --ff-only
if ($LASTEXITCODE -ne 0) { throw "研究更新失敗" }

node .\scripts\research\ma75-next-signal-local.mjs --plan
if ($LASTEXITCODE -ne 0) { throw "次回MA75計画の確認失敗" }
~~~

## 2026-11-11 after original day publication, BEFORE Nov12 09:00

**Must explicitly run the existing owner's approved one-day capture.**
This is NOT automatic. Provider availability at 16:30 is NOT
independently certified.

~~~powershell
cd C:\Users\neomo\signal-x-minute-research

$p = .\scripts\research\ma75-run-forward-day-local.ps1 -Date 2026-11-11 |
  ConvertFrom-Json
if ($LASTEXITCODE -ne 0) { throw "11/11元データの事前確認失敗" }
$p | Select-Object status,date,alreadyStored | Format-List

if ($p.alreadyStored -ne $true) {
  .\scripts\research\ma75-run-forward-day-local.ps1 -Date 2026-11-11 -Execute
  if ($LASTEXITCODE -ne 0) { throw "11/11元データ取得失敗" }
}

# Once, and ONLY between 11/11 16:30 and 11/12 09:00 JST.
$new = node .\scripts\research\ma75-next-signal-local.mjs --lock-new-cohort |
  ConvertFrom-Json
if ($LASTEXITCODE -ne 0) { throw "次の判定日の候補事前固定失敗" }
$new | Select-Object status,signalDate,allBreakouts,
  risingBreakouts,nonRisingBreakouts,lockSha256 | Format-List
~~~

The J-Quants token prompt is hidden. Never paste it or private
licensed raw OHLCV into GitHub or ChatGPT. If the new lock exists,
**NEVER call \`--lock-new-cohort\` again**. Check it instead:

~~~powershell
node .\scripts\research\ma75-next-signal-local.mjs --verify-only
~~~

Do not run \`--freeze\` on the old Nov2 snapshot!

## Later: capture completed outcome days manually

For each date Nov12, Nov13, Nov16, Nov17, Nov18, after confirmed
original-provider publication, the owner may use the existing
\`ma75-run-forward-day-local.ps1 -Date YYYY-MM-DD\` dry run,
then optional explicit \`-Execute\` only if \`alreadyStored=false\`.
Never fetch future dates in advance and never replace existing
original source files. No recurring paid API reads or cloud cron.

As of the current real Nov10 date, NONE of the new Nov11
signal outcomes are verified and this doc does NOT assign
new candidate codes or positive rates.

After genuine original pages are present, inspect without any API:

~~~powershell
$r = $null
$r = node .\scripts\research\ma75-next-signal-local.mjs --review |
  ConvertFrom-Json
if ($LASTEXITCODE -ne 0) { throw "新規MA75検証失敗" }

$r | Select-Object status,signalDate,originalBreakouts,
  originalRisingBreakouts,originalNonRisingBreakouts,sourcesObserved |
  Format-List

@('session1','session3','session5') | ForEach-Object {
  $key = $_
  $item = $r.horizons.$key
  [PSCustomObject]@{
    Horizon = $key
    Until = $item.exitSession
    Measured = $item.groups.allBreakouts.measured
    Pending = $item.groups.allBreakouts.pending
    MeanPercent = $item.groups.allBreakouts.meanNetReturnPercent
    RisingMean = $item.groups.budgetEligibleRising.meanNetReturnPercent
    NonRisingMean = $item.groups.budgetEligibleNonRising.meanNetReturnPercent
    BudgetMean = $item.groups.budgetEligibleBreakouts.meanNetReturnPercent
    WithoutBiggestWinner = $item.groups.budgetEligibleBreakouts.leaveLargestWinnerOutMeanPercent
  }
} | Format-Table -AutoSize
~~~

The first signal date is a NEW prospective SHADOW comparison,
not independently certified profitability. Multiple separate,
prelocked future dates with broad market conditions and stable
entry-time authenticity would be needed before any strategy
readiness claim. Zero actual fills, no AI POWER, no customer
notifications, no GitHub production merge, no Supabase
migration, no broker order.
