# Earnings postreaction — first real-data pilot (9468)

Status: MANUAL LOCAL PILOT ONLY. No scheduled capture, production integration or DB writes.

## Prerequisites
- Checkout PR #383 research branch on Windows PC. Keep private JQUANTS_API_KEY in the existing local environment; never paste or commit it.
- Confirm subscription entitlement and provider licensing for the financial, daily and minute endpoints.
- Existing `capture-four-pattern-jquants.mjs` can capture **one code and explicit dates** only; it is not a 100-event batch crawler. Its financial records are not automatically converted into earnings-event cohort input.

## Step 1: zero-request dry-run
From repository root in PowerShell:

```powershell
node .\scripts\research\capture-four-pattern-jquants.mjs --code=9468 --dates=2026-11-12,2026-11-13
```

This dry-run makes no API calls. Check printed planned request count and subscription rights before any execution.

## Step 2: optional explicit authenticated capture (not automatic)
Only after reviewing dry-run and confirming rights, in the same protected PowerShell session with an existing JQUANTS_API_KEY:

```powershell
$env:JQUANTS_RESEARCH_PROBE_ENABLED = 'true'
node .\scripts\research\capture-four-pattern-jquants.mjs --code=9468 --dates=2026-11-12,2026-11-13 --execute
```

The existing capture writes a private ignored archive. Never post raw licensed prices or API credentials in GitHub or chat. If financial status is quarantined, do not use it for classification. As of 2026-11-13, the event has no matured 5-day outcome.

## Step 3: study integration gates
- Verify 9468 financial disclosure and prior-year same-period row, original disclosure timestamps and corrected statements.
- Verify actual trading sessions against the official calendar; daily close and adjusted close cannot be conflated.
- Build an explicit adapter from the private archive into the local runner input, with complete dates and independent provenance checks; NOT YET IMPLEMENTED.
- Test missing sessions, release-day boundaries, corporate actions, 5-day maturity, classification, and repeated disclosure events.
- First pilot is not a statistically meaningful win rate. Expand to independent multi-company events only after pilot audit.

No research conclusions, production trades or alerts may be inferred from a dry-run.
