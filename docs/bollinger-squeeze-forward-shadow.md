# Bollinger breakout research (SHADOW ONLY)

Status: **draft PR / manual pilot implementation**, not activated. There is no unattended job, no database table, and no stored forward observations. Production main is unchanged until an independent review and merge.

## Existing independent foundations
- BB20 observation, ±2σ/±3σ and return-inside detection already exist.
- Chart pattern045 already detects BB squeezes.
- Other BB DEV Phase 7/8 workflows have distinct safety and approval boundaries. Do NOT invoke the DEV connection or historical Phase 8 execution as part of this pilot.

## Defined experiment
- Detect upper 2σ breakout on signal-day close using the **previous completed day** band, versus t-1 close <= t-2 upper band.
- Compare prior-day BB20 width <= 25th percentile of 60 earlier completed widths (SQUEEZE_UP_BREAKOUT) versus other upper breakout.
- Calculate volume ratio from completed signal volume and previous 20 trading days; 1.3x is observational ONLY.
- Grade t+1, t+3, t+5 closes using **t+1 OPEN** as the hypothetical entry; collect mean return, positive fraction, max adverse excursion. Next-day close below contemporaneous +2σ is an outcome-only failed-followthrough proxy.
- With fewer than 30 *complete* observations per category, no performance percentages are emitted. Do not infer profitability from synthetic fixture tests.

## Offline as-of and input integrity
- Pure code: app/lib/research/bollingerBreakoutShadow.mjs and bollingerBreakoutQuality.mjs.
- Historical price signals are frozen at their original close; future bars never enter as-of detection.
- Source code, OHLC validity, uniqueness and strict chronological ordering, all official trading dates, as-of completion, and provider/interval are validated before grading. An external calendar source is explicitly required; an invented date list must never be considered authoritative.
- Split events within 80 completed bars prior to signal through available +5 outcomes exclude that event. Missing split-event provenance, holidays, dropped/duplicate bars or provider delays cause a hard reject.
- Cross-stock quality is all-or-nothing; invalid symbols do not silently disappear from a comparison, which would inflate wins.
- Dividends, execution slippage/fees and corporate action revisions remain unmodeled; results are **historical simulations**, not live fills. Repeated overlapping same-stock signals can be correlated.

## Owner-only real-data pilot (not automated)
- Files: app/lib/research/bollingerBreakoutPilot.ts, API POST route under /api/admin/bollinger-breakout-shadow, and private /admin/bollinger-breakout-shadow page.
- One explicit owner click invokes the existing Yahoo daily loader for **two fixed stocks, 9984 and 3762**, at most one call each, no retry; manually launches comparisons with the 2026–2027 exchange calendar.
- Trading-day boundary is the project's existing 15:40 JST guard. Current incomplete candles are removed; if the latest expected completed bar is unavailable, the cohort fails closed.
- Results are returned to the owner page only. There is **NO** database write, auto schedule, queue, notification, change to trade/ranking/AI POWER, new migration or secret.
- This is *not* proof of daily tracking. Actual provider data quality and live results cannot be certified by unit tests.

## Tests & future automatic accumulation
CI GitHub Actions runs two offline suites on PR changes; the real-data pilot also requires a successful Vercel build and one owner-triggered data validation before considering merge.

Later work, **not activated by this PR**: separately review a bounded per-day frozen universe, source fidelity (including splits/adjustments), independent idempotent shadow archive, backfills exclusion, maturity-gated +1/+3/+5 results, auditability, production cost and rollback. Explicitly approve any DB migration/scheduled consumer. Do not reinterpret existing BB event results using signal-close entries as next-open executable results.

Run offline:
node --test tests/bollingerBreakoutShadow.test.mjs tests/bollingerBreakoutQuality.test.mjs
