# MA75 Nov 11 cohort — posthoc 1/3/5-session path audit (research only)

**SHADOW_NOT_APPROVED.** This post-outcome descriptive audit is NOT a
predeclared exit policy, and does not modify the original 2026-11-11
25-stock frozen lock or the earlier 2026-11-02 27-stock study.
No trade, notification, AI POWER, Supabase write, API call, provider
original redistribution, or production merge.

## Owner-pasted aggregate evidence as of Nov 18 (not independently authenticated)

Signal date 2026-11-11, original cohort 25 stocks
(rising MA75 16, non-rising 9), 25/25 complete at each horizon.
All windows share a **2026-11-12 OPEN** hypothetical entry with
0.1% adverse entry price and 0.1% adverse exit price.
Entries are theoretical, not independently verified fills.

| Hypothetical exit | All 25 mean net | Rising 16 mean net | Non-rising 9 mean net | All 25 positive |
| --- | ---: | ---: | ---: | ---: |
| Nov 12 CLOSE (1 session) | +0.3580% | -0.0443% | +1.0733% | 18/25 |
| Nov 16 CLOSE (3 sessions) | +0.0621% | -0.3305% | +0.7601% | 15/25 |
| Nov 18 CLOSE (5 sessions) | -2.5181% | -2.9544% | -1.7423% | 8/25 |

From day 3 to day 5, the mean of the 25 modeled cumulative net
returns fell **2.5802 percentage points** (same entry, separate
hypothetical exits). This does not identify how many of the original
day-1 positive individual securities reversed; the per-code local
join below is required. Do not retrospectively choose the best exit day.

## External TOPIX market context (not a strategy return comparison)

- Nov 12 OPEN: 3,943.52 (Fisco / Minkabu:
  https://minkabu.jp/news/4659006).
- Nov 12 CLOSE: 3,937.33 (Yahoo Finance:
  https://finance.yahoo.co.jp/quote/998405.T/history).
- Nov 16 CLOSE: 3,901.37 (Traders Web:
  https://www.traderswebfx.jp/news/article/1220823).
- Nov 18 CLOSE: 3,824.00 (Nomura:
  https://advance.quote.nomura.co.jp/meigara/nomura2/qsearch.exe?F=users/nomura/tse).

From the identical Nov12 index opening point, TOPIX index-only
returns were approximately **-0.1570%, -1.0688%, -3.0308%** at
1, 3, 5 sessions. This index-only series has **no friction**;
it is *not* a tradable matched ETF return and is market-cap weighted.
The 25-stock returns are equally weighted and already have two-sided
modeled friction. On index-only numbers, the 5-session difference is
about +0.5127 percentage points; not a certified market-adjusted edge.
If exactly 0.1% friction per side is modeled for the index too,
the five-session index return would be about -3.2245% and the
descriptive difference about +0.7064 percentage points. Neither
comparison controls for sector, size, liquidity, or survivorship.

## Owner-local, integrity-checked per-code path drilldown

Once the owner has privately stored Nov12/13/16/17/18 original
daily pages, run from the research branch checkout:

~~~powershell
cd C:\Users\neomo\signal-x-minute-research
git switch research/ma75-breakout-retest-shadow-20261031
if ($LASTEXITCODE -ne 0) { throw 'BRANCH_SWITCH_FAILED' }
git pull --ff-only
if ($LASTEXITCODE -ne 0) { throw 'GIT_PULL_FAILED' }

$a = node .\scripts\research\ma75-next-signal-path-local.mjs | ConvertFrom-Json
if ($LASTEXITCODE -ne 0) { throw 'PATH_AUDIT_FAILED' }

$a.groups.all, $a.groups.rising, $a.groups.nonRising |
 Select-Object count,positiveCount1,positiveCount3,positiveCount5,
   positive1ToNonpositive3,positive3ToNonpositive5,
   positive1ToNonpositive5,meanChange3to5Points |
 Format-Table -AutoSize

$a.perCode |
 Select-Object code,risingMA75,budgetEligible,
   ret1,ret3,ret5,change1to3,change3to5,
   oneDayWinnerFiveDayNonpositive |
 Format-Table -AutoSize

$a.groups.all.largest3to5Deteriorations | Format-Table -AutoSize
~~~

The CLI calls the pre-existing `--review` pipeline, checks the
actual Nov11 owner-local lock digest
`84bed698421ead22ebbce3fac0cb0aab08505332541acd1316957bb4151f3cab`,
requires all 25 original codes at all three horizons, stable
rising/budget group membership, and complete unquarantined results.
No missing dates are interpolated or silently dropped.

In the per-code path `+` means positive net return; `-` means
zero or negative net return. The 3-to-5 difference is a **difference
in modeled cumulative exit returns from the common entry**,
not the independently executable return over Nov16–Nov18.

Synthetic unit tests cover full join, order independence, pending
sessions, duplicate code-horizons, subgroup drift and lock tampering.
**Do not put licensed OHLCV or API keys into GitHub or chat.**
Derived per-code results may be reviewed separately. Nothing here
authorizes trading or notifications.
