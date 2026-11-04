# SIGNALX MA75 unified shadow research — 2026-11-03

**Owner research handoff. This repository/PR #297 is the sole MA75 integration lane.**
**State:** SHADOW_NOT_APPROVED. No notifications, AI POWER, broker orders,
ranking/production updates, new J-Quants subscription or scheduled API calls.

## Verified branch state at integration

Research branch: research/ma75-breakout-retest-shadow-20261031.
Existing upstream 2026-11-03 commit 12a43cab contained the separate
wick/volume research safety checks, including independent MA75 as-of
recalculation, zero/negative volume and OHLCV/time anomaly rejection,
future-bar exclusion, modeled fills, 100-share budgets, and readiness
blocking. The owner's four-file local research tests reported 38/38 pass;
this is an **owner-reported local result** and is distinct from GitHub CI.

The existing first-day frozen MA75 reference **MUST NOT BE REWRITTEN**:
- Original fixed universe: 953 symbols.
- Already captured (2026-11-02) source: 4,445 original J-Quants V2 full
  market rows in one page, of which 953 frozen source projections.
- Complete 75-session warmup: 925 codes; 28 blocked.
- One price-discontinuity quarantine; 924 analyzable.
- All MA75 crossovers on November 2: **27**.
- MA75 upward/rising subset: **22**.
- Existing local immutable cohort freeze:
  SHA256 **1ba1aee5ac05b2c0fd114d3cabe5463bde4409b203544722cf03c04fc0a6612b**.
- Snapshot integrity verification: LOCAL_FROZEN_SHADOW_COHORT_INTEGRITY_MATCH
  across 76 original source files. This is self-reported local integrity,
  **NOT independently authenticated vendor availability at a tradeable time**.

Never rerun the one-time --freeze command or overwrite the private
saved original pages. A later preview hash may change with its creation
timestamp; only the stored immutable hash is the historical reference.

## Separate data sources: no pooled win rate

1. **J-Quants V2 original daily, fixed frozen 953**: only the November 2
   original 27-cross / 22-rising shadow sample is eligible for a separately
   labeled *post-freeze* observational study, conditional on independent
   provider, session, adjustments and timestamp review.
2. **Yahoo chart display snapshot convenience sample (130 series)**:
   exploratory MA75-cross + upper-wick >=35% + relative-volume >=1.5x
   showed **five settled historical five-session outcomes** and two
   pending. Mean about +5.338% and 4/5 positives are NOT prospective odds.
   Same-day price/volume-matched controls: only **2/5** signals
   outperform their controls; average excess +4.082pp but median excess
   **-0.406pp**; two August outliers dominate the mean.
3. **Historical J-Quants MA75 rising filter**: nonoverlap N=582,
   mean five-session +0.0277% at 0.1% modeled friction per side;
   an extra +0.1 percentage points round-trip cost changes mean to
   -0.0723%. This shows economic fragility rather than robust alpha.

Never merge these source denominators, use completion-only small samples
to claim a winning future strategy, or market the historical MA75+wick
group as profitable.

## New no-network comparison (first completed 2026-11-02 day)

Existing comparison classifier:
app/lib/research/ma75WickVolumeForward.mjs;
existing MA75 recalc safety:
app/lib/research/ma75WickVolumeSafety.mjs.
**Reused, not duplicated.**

New read-only integration:
- app/lib/research/ma75FirstDayCompositeComparison.mjs
- scripts/research/ma75-compare-frozen-composite-local.mjs
- tests/ma75FirstDayCompositeComparison.test.mjs
- tests/ma75FrozenCompositeLocal.test.mjs

The local command checks the exact pinned freeze SHA, reruns existing
--verify (without --freeze), verifies 76 source fingerprints, reads the
exact same prior 75 source sessions and November 2 close, and calculates
three **separately retained** memberships:
- ALL_BREAKOUT = frozen 27 (control denominator)
- RISING_BREAKOUT = frozen 22 (subset of 27)
- WICK_VOLUME_BREAKOUT = original 27 intersect upper-wick >=35%
  and signal-day volume >=1.5 times preceding 20 completed sessions
- RISING_AND_WICK_VOLUME = overlap with frozen 22

The last two are EXTRA descriptive groups. The first two cannot change.
Some wick/volume matches may not have rising MA75; the two filters must
NOT be mislabeled as identical. No source rows beyond original Nov 2
may be used to determine any November 2 classification. If current
originals disagree with the frozen classification, fail closed.

### One-shot owner-local compare, no key and no downloads

In PowerShell at the research worktree root:

~~~powershell
cd C:\Users\neomo\signal-x-minute-research
git switch research/ma75-breakout-retest-shadow-20261031
if ($LASTEXITCODE -ne 0) { throw "MA75 research branch unavailable" }
git pull --ff-only
if ($LASTEXITCODE -ne 0) { throw "MA75 research update failed" }

$r = node .\scripts\research\ma75-compare-frozen-composite-local.mjs | ConvertFrom-Json
if ($LASTEXITCODE -ne 0) { throw "offline MA75 composite audit failed" }

$r | Select-Object status,signalDate,frozenCohortSha256,
    originalAllBreakouts,originalRisingBreakouts,
    firstDayWickAndVolumeComposite,firstDayRisingAndComposite,
    comparedCompleteOriginalBreakouts,notEvaluableBreakouts |
    Format-List

$r.perFrozenBreakout |
    Where-Object { $_.compoundMatched -eq $true } |
    Select-Object code,risingMA75,upperWickRatio,volumeRatio |
    Format-Table -AutoSize
~~~

This reads original provider pages locally, outputs only derived
code and relative wick/volume metrics; no original proprietary prices,
API key, production result or output file are written. If any source
was changed, the pinned cohort mismatches or missing original pages
prevent reliable comparison. Do not post licensed original JSON.

## Predeclared forward outcomes and gates — NOT yet observed

November 3 is a JPX cash-market holiday. Subject to official
calendar verification, Nov 2's next possible market open is
**Nov 4**. The first, third, fifth exchange sessions after the signal
would be **Nov 4, Nov 6, Nov 10**, respectively. Required J-Quants
daily prices are NOT available to this GitHub read-only research
connector until the owner captures each date after provider publication.

For EACH of the original 27 events, preserve original membership, even
when individual data are pending, invalid or quarantined. Use these
predeclared hypothetical (not guaranteed-fill) definitions:
- Entry: first subsequent verified session OPEN, adverse 0.1% friction.
- Exit horizons: +1, +3, +5 verified trading sessions CLOSE, 0.1% adverse
  friction again; retain exact pending and missing counts per horizon.
- Returns (percentage): 100 * ((exitClose * 0.999) /
  (entryOpen * 1.001) - 1). Report sensitivity to additional
  **round-trip** friction +0, +0.1, +0.2, +0.4 percentage points;
  state that these are simulations, not observed commissions.
- 100-share profit (yen): 100 * (exitClose*0.999 - entryOpen*1.001).
  Report rounding and include budget eligibility separately at the
  NEXT open; never apply the budget filter using the signal-day close.
- Max adverse move: minimum verified low from entry through the
  horizon relative to the hypothetical entry cost; explicitly not
  an actual stop-fill or peak-to-trough drawdown.
- Cohort comparison: all 27, rising 22, compound subset of 27,
  rising+compound intersection, **same signal date and same original
  frozen denominator**. Compare alongside a predeclared same-date
  baseline where source coverage is complete.
- Pending, source-vendor gaps, corporate actions, late receipts,
  bad OHLCV, abnormal opening gaps and unverified calendar are never
  treated as wins, losses, zeros or removable denominator elements.
- Return **null** for any horizon with insufficient complete evidence.
  Track number of independent signal dates, months, unique stocks,
  concentration/outliers, market regime as-of (unknown if unverifiable),
  sample size and extra costs before discussing a potential edge.
- No conclusions after only a single Nov 2 signal date. The historical
  five-event composite example cannot be recycled as forward results.

The current pure comparison produces **null returns** and
**zero independently validated future outcomes** by design.
No live result/notification permission until independent evidence and
separate authorization; keep SHADOW_NOT_APPROVED.

## Operational boundary

The reminder for **2026-11-04 21:00 JST** is already in place.
It is a reminder for human-led research, **not** a scheduled data fetch.
A user must explicitly execute each single-date source capture and
check permissions/publication first. Existing GitHub research code can
be reviewed and tested here, but actual owner-private J-Quants JSON
cannot be accessed through the GitHub connector.

Never add data keys, .env, raw provider pages, private frozen files or
real broker/order information to GitHub.


## 2026-11-04 local integrated comparison: original failure and safe recovery

The owner ran the newly added integrated comparison after successfully
fast-forwarding Git to ba04b856. The 2026-11-02 immutable 27/22 cohort
was not replaced, and the command printed only
`MA75_COMPOSITE_LOCAL_AUDIT_BLOCKED_OR_FAILED`. No derived match
count was produced. The PowerShell trailing `.` error is unrelated.

Source-code inspection found an integration design mismatch:
- The original immutable first-day crossover selected from 75 prior
  bars plus the signal close, screening abnormal CLOSE-to-CLOSE jumps.
- The later wick/volume classifier has deliberately *stricter*
  validation: opening price gaps, OHLC high==low, historical volume
  baseline, and full intra-window integrity. It previously raised a
  fatal `SOURCE_OR_FROZEN_SIGNAL_DISAGREEMENT` whenever a legitimate
  frozen crossover failed one of those later quality gates.
- That behavior discarded the entire group, incorrectly conflating
  a **stricter subgroup non-evaluability** with **tampering of the
  immutable original cohort**.

**Fix:** retain all original 27 frozen codes, the existing 22 rising
members and original SHA256. Check frozen original CLOSE-cross,
slope and historical volume-ratio integrity first. If the later
strict filter rejects flat OHLC, >45% opening gap, zero-volume
baseline, or other stricter quality, record exactly one original
code as `NOT_EVALUABLE` with a reason
`STRICT_FILTER_*`, and set `compoundMatched=null` rather than
claiming false/losing. A changed frozen original close/slope/valid
volume-ratio remains **fatal**, not quarantined. Future dates never
enter signal classification.

The CLI now emits **whitelisted uppercase error codes only** when
the comparison still fails, without provider pages, proprietary
raw prices, local paths, API keys or stack traces.

### Retry safely (no original-source write)

From the same research worktree:

~~~powershell
cd C:\Users\neomo\signal-x-minute-research
git switch research/ma75-breakout-retest-shadow-20261031
if ($LASTEXITCODE -ne 0) { throw "研究ブランチ切替失敗" }
git pull --ff-only
if ($LASTEXITCODE -ne 0) { throw "Git更新失敗" }

$r = $null
$r = node .\scripts\research\ma75-compare-frozen-composite-local.mjs | ConvertFrom-Json
if ($LASTEXITCODE -ne 0) { throw "統合比較監査失敗：表示されたエラーコードを確認" }
$r | Select-Object status,originalAllBreakouts,originalRisingBreakouts,
  firstDayWickAndVolumeComposite,firstDayRisingAndComposite,
  comparedCompleteOriginalBreakouts,notEvaluableBreakouts,
  strictQualityQuarantinedBreakouts | Format-List
$r.notEvaluableReasons | Format-List
$r.perFrozenBreakout |
  Where-Object { $_.compoundMatched -eq $true } |
  Select-Object code,risingMA75,upperWickRatio,volumeRatio |
  Format-Table -AutoSize
~~~

Do not rerun the one-time --freeze; the original local
`freezeSha256=1ba1aee5ac05b2c0fd114d3cabe5463bde4409b203544722cf03c04fc0a6612b`
and 76 original source file bytes are **not modified by this fix**.
No profit rate or trade decision is validated. An error still could
reflect a different source/integrity issue; do not claim the local
failure's exact root cause before seeing the new whitelisted code.
