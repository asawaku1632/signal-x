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
