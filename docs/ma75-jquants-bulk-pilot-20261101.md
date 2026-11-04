# Single-command 130-session historical J-Quants research pilot

**Draft research only.** Nothing starts automatically. This script has zero network calls by default; no billing or subscription changes, no GitHub Actions API key use, no app notifications and no database writes. Use only an already licensed Standard-plan J-Quants V2 daily key, configured **privately** on the local research machine.

From the signal-x repository root:

```powershell
node scripts/research/ma75-jquants-bulk-retrospective.mjs --from=2026-05-01 --to=2026-10-30
```

The above is **dry-run only**. For a real read on a machine with an existing private API key, run with `--execute` after setting `JQUANTS_API_KEY` and `SIGNALX_RESEARCH_ALLOW_JQUANTS_READONLY=YES` in the private environment. **Do not paste a key in ChatGPT or GitHub.**

The script fetches the complete official calendar in the specified bounded range, selects no more than the latest 130 TSE trading days (at least 91 required), and obtains ALL LISTED daily pages for each day, sequentially, with a pause between dates and a hard 12-page limit per date. A 429, truncated pagination or corrupt provider row aborts instead of retrying or inventing data. It stores each raw day inside the ignored `research-private/` folder using exclusive create, and saves only aggregate retrospective breakout/retest metrics separately. Do not commit, share, or redistribute licensed provider raw responses.

**This does NOT complete independent forward validation.** The frozen 953 codes were selected on 2026-10-30, after the period being retrospectively studied. As of 2026-11-01, no market session has elapsed after the 2026-10-31 freeze, so there are zero genuinely prospective events to settle. A 75-day warmup + 10-day wait + five-day outcome is 90 sessions minimum; meaningful independent validation also needs many signal dates/months, clean corporate-action processing, transaction cost/risk checks and future outcome data.

All research outputs keep `eligibleForProduction=false` and `eligibleForNotifications=false`. This tool is a provider-acquisition convenience and not a guaranteed profitable trading system.

## Windows: live progress with a one-command private-key prompt (2026-11-01)

If the provider calendar probe returned **`JQUANTS_HTTP_STATUS=200`** but the prior manual PowerShell block then produced no text, that alone did **not** establish a hang: the 130-date bulk script previously printed only its final report, and it imposes an eight-second gap between newly downloaded days. Stop the previous command with Ctrl+C before starting a different local command; do not launch concurrent provider captures or delete local files.

From the latest PR #297 research branch, after `git pull --ff-only`:

```powershell
.\scripts\research\ma75-run-local-jquants.ps1
.\scripts\research\ma75-run-local-jquants.ps1 -Execute
```

The first command performs only a dry-run and requires **no key**. The second prompts locally for the existing J-Quants V2 API key with hidden input, supplies it to Node in the process environment, then restores the prior environment and zeros the native secret copy. It **does not** download any Vercel secrets, write a key to a file, change a subscription, deploy, merge, or touch production DB/notifications.

The Node study now prints `MA75_PROGRESS` lines with phases `CALENDAR_START`, `CALENDAR_READY`, `DAY_START`, `DAY_COMPLETE`, `ANALYSIS_START` and `ANALYSIS_COMPLETE`. `DAY_COMPLETE` includes `done`/`total`, date, and original provider row count. No credential or original provider response is printed. Existing daily captures in ignored `research-private/` are validated and reused on restart; `source:SAVED_LOCAL` differentiates them from fresh `source:JQUANTS_API` days. A failed day is not accepted as complete and the full-population win rate remains withheld if original data coverage is incomplete.

The current code still requires a locally verified real run before any claim that original 130 sessions were collected or that authentic historical win rates were computed. The outputs are retrospective and not independent forward proof.

## Completed first real local 122-session capture; offline denominator audit

A user-local run on 2026-11-01 reported the final `HISTORICAL_ONLY` private summary for 2026-05-01 through 2026-10-30:

- 122 / 122 calendar-selected sessions, **542,190 original full-market date rows**; 24 cached days and 98 newly downloaded on the final run
- Fixed cohort **953** stocks, with **912** stocks having `DAILY_BAR` in all 122 sessions; **41** missing at least one required date
- Across 953 × 122 required stock-date slots: **242 `MISSING_PROVIDER_ROW`** and **38 `CORPORATE_ACTION_REVIEW`**
- Actual frozen-universe-wide historical return fields `results` and `paired` remain **null**, with no independent forward results as of the 2026-10-31 frozen-cohort date; production and notification eligibility stay false

**Offline next stage:** From the repo root (research branch), run:

```powershell
node .\scripts\research\ma75-local-coverage-audit.mjs
```

This command requires **no API key, env settings, Vercel, subscription changes, extra download or network**. It loads the existing ignored `research-private/` daily files, verifies each saved full-date capture against the frozen cohort, reconciles the original terminal summary, and reports the per-code missing date ranges and event reasons. It also prints the existing **912-stock complete-history subset's retrospective statistics separately** as `historicalCompleteCaseDiagnostic`, never as the full 953-stock result. Because the frozen stock sample was assembled on October 30 and historical completeness is retrospectively known, selection/survivorship and event overlap biases remain; these rates cannot be used as independent buy signals.

Do not upload private original daily JSON files, API credentials, or the contents of `.env.local`. For review, paste **only** the terminal's aggregate `ma75_local_completion_audit_v1` report, which contains counts, codes, and descriptive statistics but excludes raw prices and credentials.

The original primary summary is immutable and is not overwritten. If 122 saved dates cannot be reconciled or data are tampered with, the diagnostic fails closed; no incomplete data are silently treated as full coverage.


## First owner-local retrospective evidence: plain MA75 entry has no demonstrated advantage

On 2026-11-01 the owner ran the private 122-date **read-only** completion audit, yielding the **912 of 953 fixed snapshot codes** with valid complete histories. This is not the 953-code headline and has no independent after-freeze observations.

**All complete cases, synthetic next-open buy and day-five-close sell, 0.1% friction each side:**

| Signal | Observed | Five-day complete | Win rate | Mean net five-day return | Mean 100-share P/L |
| --- | ---: | ---: | ---: | ---: | ---: |
| MA75 breakout | 1,162 | 1,029 | 43.63% | -0.4586% | -¥2,510 |
| MA75 support retest | 553 | 508 | 44.49% | -0.6067% | -¥3,289 |

The completed budget-eligible breakout subset (from the actual **next open**, which was not known at the breakout close) had 725 outcomes, 43.17% win and mean -0.4667%. The analogous retest subset had 365 outcomes, 42.47% win and mean -0.7917%. No taxes or all real execution costs are accounted for.

The 508 **ex-post paired** breakout/retest observations had breakout mean **+0.7891%** and retest mean **-0.6067%**, breakout win **56.5%**, retest win **44.49%**, and retest outperformed breakout in **28.15%**. Crucially, these 508 breakout cases were selected **because a later retest occurred**. At the original breakout close the future retest was unknowable; this is not an implementable breakout-filter rule and must not be touted as a +0.79% edge.

The 41 history-incomplete codes (242 absent provider rows and 38 corporate-action-review code-days, overlapping by code) remain outside the complete-history subset. The full 953-code winning rate is **not determined**. Signals on the same code can overlap, historical winners are selected from a later snapshot and the observed window includes only a short post-SMA75 portion; even positive historical subgroup statistics would not establish a deployable forward advantage.

### Ex-ante condition check, still deliberately exploratory

The offline completion audit now also includes `historicalCompleteCaseDiagnostic.precloseConditions`: four **fixed, reproducible** exploratory groups: all breakouts; 75-day SMA rising at signal close; breakout-day volume at least 1.5 times the preceding 20-day mean; both conditions. Each reports settled/pending/quarantined counts, 5-day descriptive win/return metrics and **signal-month breakdowns**. Criteria use only completed-close information, but these hypotheses were selected **after** looking at aggregate history. They are *not* a genuine held-out training/test split, and a discovered positive subset may still be noise, time clustering or multiple testing. Budget eligibility calculated from the **next actual open** is explicitly an execution diagnostic, *not* a feature available at signal close.

Use the unchanged command:

```powershell
git switch research/ma75-breakout-retest-shadow-20261031
git pull --ff-only
node .\scripts\research\ma75-local-coverage-audit.mjs
```

For compact sharing, the user may locally run `node .\scripts\research\ma75-local-coverage-audit.mjs | ConvertFrom-Json | Select-Object -ExpandProperty historicalCompleteCaseDiagnostic | Select-Object -ExpandProperty precloseConditions | ConvertTo-Json -Depth 12`; this prints **derived aggregate data**, no API key or original private daily source files. Do not upload raw licensed J-Quants pages.

**Decision: keep signal promotion locked.** `eligibleForProduction`, `eligibleForNotifications` and `eligibleForTrading` remain false until post-freeze forward observations, reliable adjustment/event handling, robust independent dates and market regimes and realistic costs are verified.


## Local preclose subgroup evidence and no-leakage stress checks (2026-11-01)

Owner-local J-Quants historical output for the 912 complete-history subset, with assumed 0.1% friction per side and 5-session exits:

| Observable at signal-close condition | Signals | Completed 5-session outcomes | Win rate | Mean net 5-session return |
| --- | ---: | ---: | ---: | ---: |
| All MA75 breakouts | 1,162 | 1,029 | 43.63% | -0.4586% |
| Rising 75-session SMA | 808 | 717 | 47.84% | -0.0062% |
| Signal-date volume >=1.5x previous 20 dates | 179 | 146 | 40.41% | -1.3127% |
| Rising SMA75 AND volume >=1.5x | 116 | 94 | 44.68% | -0.6896% |

This **does not demonstrate a positive edge**. Rising SMA75 improved the retrospective *complete-case subset* average to near zero, not positive; 90 rising-SMA signals lack a complete five-session outcome and one was quarantined. The high-volume criteria were *negative* in the observed period. Since only 122 daily bars were captured and 75 were needed as warmup, the usable breakout window is short. Retrospective feature comparisons and any choice to prefer rising-SMA were made after seeing this sample, not confirmed on genuinely unseen dates.

### Independent diagnostic, not a new winning condition

A pure offline helper `scripts/research/ma75-historical-robustness.mjs` now reports for each existing condition:
1. The number of distinct signal dates and dates with completed outcomes.
2. **Equal-weighted average of each completed signal date's mean return**, alongside trade/event-weighted mean (to expose event-heavy days).
3. Greedy earliest-in-time, **per-security five-session non-overlap selection** fixed without looking at later return or later retest. Both completed and pending counts are preserved.
4. Worst and best completed signal-date means as exploratory concentration diagnostics.

These observations are not independent across stocks or calendar dates, and equal-date weighting is **not** a traded portfolio or a cure for selection bias. The non-overlap rule does not use future wins; later events are dropped strictly by a five-session interval after the first signal on a code. No p-values, validated win rates, or trade eligibility are claimed.

The offline command is the same (no API key, no network, no output file writes):

```powershell
git switch research/ma75-breakout-retest-shadow-20261031
git pull --ff-only
$report = node .\scripts\research\ma75-local-coverage-audit.mjs | ConvertFrom-Json
$report.historicalCompleteCaseDiagnostic.precloseConditions.conditions |
    ForEach-Object {
      [PSCustomObject]@{
        condition = $_.condition
        completed = $_.completed
        mean5 = $_.averageReturn5Percent
        signalDates = $_.dependenceStressCheck.allSignals.distinctSignalDates
        equalDateMean5 = $_.dependenceStressCheck.allSignals.completedSignalDateEqualWeightedAverage5Percent
        nonOverlapCompleted = $_.dependenceStressCheck.earliestNonOverlappingPerCode.completed
        nonOverlapMean5 = $_.dependenceStressCheck.earliestNonOverlappingPerCode.completedTradeWeightedAverage5Percent
      }
    } | Format-Table -AutoSize
```

Only derived summary metrics are printed; the original licensed files remain private. Even if a subgroup looks positive in this check, it remains in shadow research. Independent post-freeze dates, realistic fills, market regime and multiple-hypothesis robustness must be established before any promotion into the app.
