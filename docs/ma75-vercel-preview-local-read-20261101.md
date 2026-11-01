# One-command local J-Quants Standard historic data research — November 2026

This is **local opt-in only**. The GitHub PR remains Draft/shadow. The PowerShell wrapper validates the exact Vercel project and team before it asks Vercel CLI to supply the existing **Preview** JQUANTS_API_KEY to a Node subprocess. The key itself is never printed or saved to an `.env` file by this wrapper. Use only existing Standard entitlement; the wrapper cannot buy a plan, enable minute add-ons, change Vercel settings, deploy, push or merge.

From the latest signal-x research-branch checkout on **Windows PowerShell**:

1. Dry-run, zero network: `./scripts/research/ma75-run-with-vercel-preview.ps1`
2. If not linked yet, use Vercel CLI to sign in and link the **same account**: `vercel link --project signal-x --scope signalx-runner-v2-trial2`. The wrapper refuses any unexpected `.vercel/project.json` project/team ID.
3. Explicit historical live read, already authorized data only: `./scripts/research/ma75-run-with-vercel-preview.ps1 -Execute`

Step (3) invokes `vercel env run -e preview --git-branch research/ma75-breakout-retest-shadow-20261031 -- node scripts/research/ma75-jquants-bulk-retrospective.mjs --from=2026-05-01 --to=2026-10-30 --execute`.

This reads an official raw business calendar, validates each calendar day, requests original all-listed OHLCV for at most 130 market days sequentially at bounded pace, audits complete pagination and per-frozen-symbol coverage, and stores raw day responses locally inside ignored `research-private/`. A previously completed day is reused **only after its original source rows/date/pagination and captured code counts are revalidated**. An untrustworthy or incomplete existing file fails safely; no overwrite or invented results. Process-level `SIGNALX_RESEARCH_ALLOW_JQUANTS_READONLY=YES` is restored afterward.

The end-of-run summary keeps full-population profit-rate fields **null** if any code lacks complete historical coverage. Subset/IPO/no-trade/corporate-action gaps are counted; they cannot silently become complete 953-stock profitability. An eligible signal is a completed close with next-session simulated entry, NOT a historical "what we knew before opening" signal. This retrospective study does not establish future trading returns.

The CLI writes a private summary named `research-private/ma75-jquants-bulk-summary-2026-10-30.json`. Do not commit or paste the original responses or API keys. Reading provider API does not incur a new subscription charge by itself, but is subject to contracted limits and existing platform usage.

**This run has NOT been executed by ChatGPT.** Only code safety and mocked integration tests were run. True 76-session J-Quants acquisition and user-specific forward profit numbers remain unconfirmed until an authorized local execution produces an authenticated output.

Official Vercel source: https://vercel.com/docs/cli/env
Official J-Quants daily source: https://jpx-jquants.com/ja/spec/eq-bars-daily
Official J-Quants calendar source: https://jpx-jquants.com/ja/spec/mkt-cal
