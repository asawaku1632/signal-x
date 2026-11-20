# BB_CANDLE_V1 same-slot cross-stock clusters (offline SHADOW)

This study tests the *descriptive* possibility that several BUY signals on the same date and same entry slot coincide with later losses. It is not a trading rule.

Data come exclusively from the already privately stored and previously reconciled three 20-session archives (3762, 7203, 7752), the pair of 8053 overlapping captures and historical TOPIX. All capture files remain on the user's Windows PC.

The grouping key is **date + entry slot**, unique security code required. Future outcomes are never used for group assignment, and two appearances of the same stock/date/slot trigger a hard error. Groups of 2+ distinct stocks are labeled co-occurrence; singletons are tracked separately. A shared market shock can cause correlated outcomes, so treating each stock as an independent observation would inflate confidence.

The earlier user-reported raw observations include 7752 and 8053 both at 14:15 on 2026-10-27, each with negative 5-day historical scenario outcomes. Whether this phenomenon is general needs a far larger untouched data cohort, *especially positive and negative examples of both solo and multi-stock signals*.

Local command:

```powershell
git pull --ff-only
node --test tests/bbSameSlotClusters.test.mjs tests/bbCandleRiskDiagnostic.test.mjs tests/bb8053Overlap.test.mjs
if ($LASTEXITCODE -eq 0) {
  node .\scripts\research\bb-same-slot-clusters.mjs `
  ".\.private-research\bb-candle-topix-20260925-20261104.json" `
  "C:\Users\neomo\signal-x-four-pattern\.private-research\four-pattern-jquants-3762-2026-10-06-2026-11-04.json" `
  "C:\Users\neomo\signal-x-four-pattern\.private-research\four-pattern-jquants-7203-2026-10-06-2026-11-04.json" `
  "C:\Users\neomo\signal-x-four-pattern\.private-research\four-pattern-jquants-7752-2026-10-06-2026-11-04.json" `
  "C:\Users\neomo\signal-x-earnings-research\.private-research\four-pattern-jquants-8053-2026-10-27-2026-10-29.json" `
  "C:\Users\neomo\signal-x-earnings-research\.private-research\four-pattern-jquants-8053-2026-10-28-2026-11-04.json"
}
```

No J-Quants API calls, file changes, broker access, notifications, secrets, production logic or claimed statistical win rate. Output is only event-level historical hypothetical results, not investment recommendations. Existing 5-day returns assume modeled spreads and prior-day TOPIX classification as implemented elsewhere, and do not show actual fill quality or live data timing.
