# Offline 76-session private saved-date audit

This script reads previously captured full-market date files **sequentially**, instead of combining all 76 raw J-Quants pages into a single huge JSON. No API calls, credentials, Supabase writes, subscriptions, scheduled jobs, production signals or trades.

Start at the signal-x repository root. Create an ignored local folder: `mkdir research-private`. Never commit original licensed responses.

Write `research-private/manifest.json` with `version:"ma75_private_day_manifest_v1"`, `sessions` containing exactly 76 real ascending TSE stock trading dates, `calendarFile:"research-private/calendar.json"`, and `entries` of `{"date":"YYYY-MM-DD","file":"research-private/YYYY-MM-DD.json"}`. Each date file must be a valid saved result from `ma75-jquants-one-date-capture.mjs`; the calendar must be a complete independently captured J-Quants HolDiv response (including holidays and non-trading dates). **Do not fabricate missing dates or responses.**

Command:

```powershell
node scripts/research/ma75-saved-days-audit.mjs --manifest=research-private/manifest.json --output=research-private/summary.json
```

The input files must be within `research-private/`; 16 MiB max each and no symlinks. It validates raw source row counts, source receipt timestamps, original pagination, all-listed-to-frozen code matching, full 76 dates and calendar, and corporate-action holds. The output is aggregate-only and exclusively created (no overwrite). If any date or stock-day is missing, retrospective breakout counts stay null. Even full structural coverage proves neither licensed provenance nor tradable predictive edge; all live and notification flags remain false.
