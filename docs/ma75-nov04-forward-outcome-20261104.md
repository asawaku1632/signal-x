# SIGNALX MA75 first-session outcomes — local original bars, 2026-11-04

**Research state: SHADOW_NOT_APPROVED.** This report documents
owner-pasted summary output from a **read-only local J-Quants V2
historical observation**. No original licensed OHLCV or API key is
stored here. The original published availability/usage rights and
prospective entry fill are NOT independently authenticated.

## Immutable November 2 signal population

- Frozen 953-stock original universe (not cherry-picked after returns).
- Valid 75-session history in 925; 28 unavailable, one discontinuity;
  924 original analyzable securities.
- 2026-11-02 complete closing SMA75 crossovers: **27**, of which
  **22** had a rising SMA75.
- Upper wick >=35% and volume / previous 20-day mean >=1.5:
  **3 (1878, 7172, 9832)**, all nested within 22.
- SHA256 of the owner-local immutable original candidate cohort:
  **1ba1aee5ac05b2c0fd114d3cabe5463bde4409b203544722cf03c04fc0a6612b**
  (owner's 76 original input source files self-consistently reverified).

The original 27/22/3 populations MUST NOT be revised based on these
outcomes. Do not rerun \`--freeze\`.

## Actual local output: Nov 4 OPEN -> Nov 4 CLOSE, hypothetical

All counts refer to the FIRST session after Nov 2 signal, not
out-of-sample profitability validation across independent periods.
The backtest models **0.1% adverse friction per side**. No taxes,
exchange order executions, liquidity fill, capture as-of proof or
official corporate-action certification.

| Frozen group | n measured | mean net % | median net % | positive rate | mean P/L per 100 shares |
|---|---:|---:|---:|---:|---:|
| All SMA75 breakouts | 27/27 | -1.0329% | -0.7567% | 29.63% | -¥7,489.78 |
| SMA75 rising subset | 22/22 | -1.0468% | -0.6931% | 31.82% | -¥3,580.04 |
| Upper-wick+volume subgroup | 3/3 | -1.1875% | -1.0864% | 33.33% | -¥2,303.43 |

**0 pending, 0 quarantined among the 27** for this local first-session
reading. Group overlaps are not independent experiments; percentage
means and yen means are unweighted *per security* (yen depends heavily
on each stock's absolute price).

| Code | subgroup | first-session net % | modeled 100-share P/L | worst observed intraday low vs. modeled entry |
|---|---|---:|---:|---:|
| 1878 | rising + wick-volume | +0.0359% | +¥121.60 | -0.1884% |
| 7172 | rising + wick-volume | -2.5120% | -¥5,318.10 | -3.3118% |
| 9832 | rising + wick-volume | -1.0864% | -¥1,713.80 | -0.9873% |

The subgroup's observed mean return is **0.1546 percentage points
below** the all-27 mean, and **0.1407 percentage points below**
the rising-22 mean. This one observation day cannot prove a consistently
inferior or superior strategy. Any future selection change motivated
by seeing Nov 4 outcomes must be a *new* separately predeclared test
using later signals, not retroactive improvement of these cohorts.

## New 1/3/5-session follow-up implementation

\`app/lib/research/ma75FrozenForwardHorizons.mjs\` and
\`scripts/research/ma75-135-horizons-local.mjs\` are pure/read-only
research. They repeat strict pinned-cohort code identity checks,
compare the first-day input with Nov 4 original source, then only
settle subsequent horizons when ALL required exchange-session dates
have originally saved, time-consistent and valid OHLCV pages.

- 1-session return: Nov 4 close, original Nov 4 open modeled entry.
- 3-session return: Nov 6 close; requires Nov 4/5/6 sources.
- 5-session return: Nov 10 close; requires Nov 4/5/6/9/10 sources.
- Maximum adverse excursion in each horizon: lowest observed LOW
  relative to modeled Nov 4 entry cost. It is not a stop-fill measure.
- 100-share net P/L, modeled budget eligibility, additional cost
  sensitivity +0, +0.1, +0.2 and +0.4 percentage points round-trip
  are shown separately. The cost sensitivity is a first-order
  approximation, not observed fees.
- Data pending/missing source calendar sessions, corporate actions,
  invalid/inconsistent OHLCV and >45% intersession opening/closing
  gaps remain PENDING or QUARANTINED with their codes retained.
- As of Nov 4, **3-day and 5-day outcomes are NOT YET MEASURED**.
  A code test or synthetic fixture is NOT additional original
  J-Quants forward return evidence.

### Run locally now: read-only and zero API calls

~~~powershell
cd C:\Users\neomo\signal-x-minute-research
git pull --ff-only
if ($LASTEXITCODE -ne 0) { throw "Git更新失敗" }

$r = $null
$r = node .\scripts\research\ma75-135-horizons-local.mjs | ConvertFrom-Json
if ($LASTEXITCODE -ne 0) { throw "1/3/5営業日の読取監査失敗" }

$r | Select-Object status,originalAllBreakouts,originalRisingBreakouts,
  originalWickVolumeComposite,originalCohortSha256,inputOriginalDays |
  Format-List
$r.horizons.session1.groups | Format-List
$r.horizons.session3.groups | Format-List
$r.horizons.session5.groups | Format-List
~~~

If no additional original day is saved yet, 3/5-session group means
MUST remain null and 27 original candidates pending. The command
never downloads any new data and never writes to the frozen file.

For each genuinely newly published daily source, the owner may choose
to perform the *existing* explicit one-date dry run and, only if
\`alreadyStored=false\`, the owner-controlled \`-Execute\`
for Nov 5, Nov 6, Nov 9 and Nov 10 separately. There is no scheduled
API download, no automatic backfill, no new paid subscription and
no live trade. Any 16:30 local planning floor does not certify
provider publication for that date.

**Do not enable production ranking or alerts**. Await multiple
independent later signal dates, audit external licensing/timestamp
provenance, corporate action effects and realistic executions.


## 2026-11-06 close / three-session subgroup result (owner-local log received 2026-11-09)

This is **user-provided derived local PowerShell output**, not a
remote read of licensed J-Quants V2 pages. All three previously frozen
wick-volume codes reported `HYPOTHETICAL_HORIZON_ONLY` for horizon=3.
The assumed entry was the **2026-11-04 OPEN** and hypothetical exit
was the **2026-11-06 CLOSE**, with modeled adverse friction of
0.1% per side. Stock IDs and frozen 27/22/3 denominators were NOT
changed.

| Original frozen code | horizon 3 net % | modeled P/L on 100 shares | minimum observed LOW vs modeled Nov4 entry |
|---|---:|---:|---:|
| 1878 | -4.0587% | -¥13,764.50 | -4.0806% |
| 7172 | -2.8423% | -¥6,017.40 | -3.8786% |
| 9832 | -2.9228% | -¥4,610.90 | -2.8256% |
| **Three-code mean** | **-3.2746%** | **-¥8,130.93** | not aggregated here |

All three observed net outcomes were negative (positive ratio 0/3).
The mean of the prior Nov4 first-session results for the SAME three
codes was -1.1875%; three-session mean is 2.0871 percentage points
lower. The total modeled profit across 100 shares of each code would
be -¥24,392.80 (fictional simultaneous ownership of 300 shares across
three securities, not an executed portfolio or position size
recommendation). The recorded minimum LOW values are relative to
entry, not stop-loss fills; modeled same-close losses can exceed the
daily minimum-price move after accounting for exit friction.

**No new entire-27 or rising-22 three-day aggregate is claimed**:
the user's pasted log contains only the three-code subgroup rows.
The remaining 24 codes may have been locally evaluated, but their
aggregate statistics were not supplied. Do not label them
complete or estimate their means from these three rows.

The 5-session 2026-11-10 outcome remains **PENDING**, not a zero
return. After genuine provider publication, the owner may manually
capture 2026-11-09 and 2026-11-10 ORIGINAL daily pages using the
existing one-date script, without overwriting any existing file,
then rerun the same read-only 1/3/5 ledger. No automatically scheduled
data retrieval, no re-freeze, no retroactive selection or reclassification.
Provider rights and the next-open fill remain unverified, and study
state remains **SHADOW_NOT_APPROVED**. These three cases from one
single signal date do not establish reproducible expected gains or
losses.


## 2026-11-06 close / full 27-versus-22-versus-3 comparison (owner-local log received 2026-11-09)

The owner has now separately provided the **full `$h.horizons.session3.groups`
PowerShell aggregate output** from the same read-only original-source
1/3/5 ledger. This supersedes the earlier statement in this document
that the 27- and 22-code aggregates were not yet supplied. Group
definitions remain the ORIGINAL Nov 2 immutable cohorts; signals
were NOT reselected after observing results. One signal date, one
Nov 4 entry-open to Nov 6 exit-close observational window; modeled
0.1% adverse friction per side, not actual broker execution.

| Original overlapping group | measured / frozen | pending | quarantined | mean modeled net return | median modeled net return | percent positive | mean modeled 100-share P/L |
|---|---:|---:|---:|---:|---:|---:|---:|
| All MA75 closing breakouts | 27 / 27 | 0 | 0 | **-3.8980%** | -2.9228% | 11.11% (3/27) | -¥41,977.48 |
| Rising MA75 subset | 22 / 22 | 0 | 0 | **-3.4807%** | -2.9047% | 9.09% (2/22) | -¥11,419.92 |
| Upper wick >=35% and volume >=1.5x | 3 / 3 | 0 | 0 | **-3.2746%** | -2.9228% | 0.00% (0/3) | -¥8,130.93 |
| Rising AND wick+volume intersection | 3 / 3 | 0 | 0 | **-3.2746%** | -2.9228% | 0.00% (0/3) | -¥8,130.93 |

The relative GROUP MEAN loss differences are **+0.6234 percentage
points vs the 27-stock baseline** and **+0.2061 percentage points
vs rising-22** (less negative, not profitable); the rising subset
itself is +0.4173 points less negative than all 27. These groups
OVERLAP, hence are not independent randomized controls. The compound
filter's 0/3 positive results and small sample do not prove an
advantage even though its average was marginally less negative.

Other owner-reported aggregate checks:
- Median worst LOW vs modeled first-session entry cost: all 27
  **-3.9668%**, rising 22 **-3.9227%**, compound 3 **-3.8786%**.
- Modeled budget eligibility (100-share lots, ¥100k–¥500k
  investigation range): **22/27**, **20/22**, and **3/3**, respectively.
- The P/L mean in yen per 100 shares is not a fair stand-alone
  strategy comparator, because different nominal stock prices and
  **budget-ineligible codes** are included in the per-stock yen
  averages. The percent-return comparison above is the more relevant
  *unweighted descriptive* comparison; it is still highly vulnerable
  to three-stock noise and a single-market-day shock.
- Additional round-trip cost sensitivity exists in the structured
  source output but its numeric array was not included in the pasted
  log, so no user-specific numerical values are inferred.
- Prior Nov 4 first-session mean (already recorded) was
  -1.0329% all-27, -1.0468% rising-22 and -1.1875%
  compound-3. Nov 6 modeled mean loss was more negative for all.
- This confirms a descriptive **3-session calculation for 27/27**,
  not market-price as-of certification, independently validated
  forward returns, actual next-open purchases, or stable strategy
  win probabilities.

**5-session result as of this record: still not reported / pending.**
The required Nov 9 and Nov 10 daily originals must be checked,
obtained by the owner with the already existing explicit single-day
capture only when available, and never fabricated or uploaded.
Original Nov 2 SHA256 stays
`1ba1aee5ac05b2c0fd114d3cabe5463bde4409b203544722cf03c04fc0a6612b`.
No re-freezing; retain **SHADOW_NOT_APPROVED**, Draft PR, no production
AI POWER, notifications or trades.


## 2026-11-10 CLOSE: completed five-session 27/22/3 owner-local outcome

**Status of this section:** the user pasted derived final audit values
from their private local `ma75-135-horizons-local.mjs` output after
an explicit 2026-11-10 original-source capture. This is a
**retrospective hypothetical** study, NOT verified next-open execution,
prospective actionable alerts, independently certified vendor
publication/timing or investment advice.

The November 10 one-day J-Quants V2 owner-local source was stored
without replacing any original: capture status
`ORIGINAL_FORWARD_DAY_CAPTURED_PRIVATE`, original provider rows
**4,449**, original pages **1**, frozen projected rows **953**.
Previously archived Nov 4/5/6/9 pages were held privately; the
five-session offline ledger completed successfully with **all original
27 candidates measured, zero pending, zero quarantined**, and the
original Nov 2 frozen group membership unchanged. The pinned
source/cohort SHA remains the earlier
`1ba1aee5ac05b2c0fd114d3cabe5463bde4409b203544722cf03c04fc0a6612b`;
this last hash value was verified in prior user logs, not independently
recomputed by the GitHub connector from private licensed files.

**Entry model:** 2026-11-04 original OPEN, +0.1% adverse cost.
**5-session exit model:** 2026-11-10 original CLOSE, -0.1% adverse cost.
Both are counterfactual prices rather than actual fills. The original
cohorts overlap and all derive from just ONE 2026-11-02 signal date.

| Unchanged Nov2 frozen group | 5-session evaluated | pending / quarantined | mean hypothetical net % | median % | positive / total | mean simulated yen P/L per 100 shares | ¥100k-¥500k budget-eligible |
|---|---:|---:|---:|---:|---:|---:|---:|
| MA75 closing breakouts (all) | 27/27 | 0/0 | **+0.4501%** | +0.5699% | 15/27 = 55.56% | **-¥17,936.73** | 22/27 |
| Rising MA75 subset | 22/22 | 0/0 | **+0.2978%** | +0.5519% | 12/22 = 54.55% | **-¥1,003.08** | 20/22 |
| Upper wick>=35% AND volume ratio>=1.5x | 3/3 | 0/0 | **-1.3560%** | -1.7316% | 1/3 = 33.33% | **-¥3,069.33** | 3/3 |
| Rising AND upper-wick + volume (same three IDs) | 3/3 | 0/0 | **-1.3560%** | -1.7316% | 1/3 = 33.33% | **-¥3,069.33** | 3/3 |

Other user-reported medians of minimum intrahorizon observed LOW
versus modelled entry cost: all 27 **-3.9668%**, rising 22
**-3.9227%**, compound 3 **-3.8786%**.
These values do not prove stop-order fill or actual maximum drawdown.

### Across 1, 3 and 5 sessions

| Original frozen subgroup | Nov 4 close (1) mean | Nov 6 close (3) mean | Nov 10 close (5) mean |
|---|---:|---:|---:|
| All 27 | -1.0329% | -3.8980% | **+0.4501%** |
| Rising 22 | -1.0468% | -3.4807% | **+0.2978%** |
| Wick + volume 3 | -1.1875% | -3.2746% | **-1.3560%** |

This observed multi-date pattern shows a strong recovery in the
**cross-sectional equal-stock average of original 27** after Nov 6.
It does NOT establish a robust temporal signal on a single signal day,
because the five-day increase could reflect a common market rebound.
Most crucially, the three-code composite filter underperformed the
all-27 simple breakout group by **-1.8061 percentage points**, and
the rising-22 subgroup by **-1.6538 percentage points** on the
five-session unweighted average despite the compound group's
relative advantage at the earlier three-session horizon.
Do not cherry-pick the best exit date after seeing outcomes.

### Why average percentage is positive yet 100-share yen P/L is negative

The return percentage group average weights each stock equally.
The arithmetic mean 100-share yen P/L implicitly weights higher
nominal-price stocks much more strongly. If a high-price security loses,
the yen loss may dominate several smaller-price winners. In this
sample, the ALL group reported **+0.4501% mean net percentage** but
**-¥17,936.73 mean modeled 100-share yen P/L**. This is NOT a
calculation contradiction, nor evidence an affordable, constrained
portfolio was profitable. Five codes in the original 27 failed
the prescribed budget eligibility. The 22/27 budget subset's
own mean net return, execution constraints, common-date exposure,
liquidity, lot size, slippage, taxes and corporate actions have not
been separately supplied or externally audited. No positive
budget-restricted claim should be made.

**Decision:** completed first original signal-date 1/3/5 descriptive
observations but **strategy not approved**. Neither original 27,
rising 22, nor wick-volume 3 can be promoted on just one signal date.
No new rules should be optimized on these outcomes and sold as a
prospective success. Further independent newly frozen signal dates,
external source rights/timing, exchange-calendar verification and
realistic position/budget validation are required. Research remains
`SHADOW_NOT_APPROVED`, and PR #297 remains Draft. No
production/AI POWER/notifications/trading, re-freeze, original-source
upload or extra J-Quants network request was performed by this
documentation update.
