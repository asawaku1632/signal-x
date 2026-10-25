# STEP 140 evidence update — 2026-10-25

## Recovered source material
Five user-provided J-Quants **read-only historical diagnostic outputs**, batches 1–5 of `CURATED_20_BATCH`, were recovered from earlier conversation attachments (`貼り付けたMarkdown(3).md` through `貼り付けたMarkdown(7).md`).

The five attachments were programmatically parsed locally, with assertions that:
- all five batches are present and each has four unique selected stocks;
- all 20 selected codes are unique;
- exactly 24 independent event identity tuples (code, cohort, startDate) are unique;
- five-session first-event results comprise 15 matured, 9 pending, 11 positive and 4 negative.

**All assertions passed on the recovered attachments.** Source file SHA-256 digests and the 24 event-level records were committed to `docs/research/dual-surge-user-diagnostic-events-20261025.json`.

## Scope and remaining limitations
This is now an **event-level reconciliation to previously user-provided diagnostic output**, not merely aggregate arithmetic. It is not an independent rerun against licensed raw J-Quants OHLCV, and does not establish provider license, actual trading fills, or prospective performance.

Ten additional research tests compare the recovered event reference with the frozen aggregate baseline, and the research workflow includes the new test file. Source-declaration count: **146 tests** (previous 136 plus 10), not a verified CI pass.

## STEP 140 acceptance
- Historical diagnostic event identity and five-session outcome reconciliation: **COMPLETE against recovered diagnostic attachments**.
- Independent raw OHLCV replay and license provenance: **NOT VERIFIED**.
- Full GitHub Actions run and passing result: **NOT VERIFIED** (connector commit-run lookup returns no PR workflow runs).
- Production approval: **NO**.
- STEP 140 complete: **NO**, if full CI pass and independent provider replay are required.

Research-only draft PR #212 remains unmerged. No production changes, provider collection, cron, notifications or Supabase writes.

## 2026-10-25 verification follow-up
- Re-read all five original uploaded Markdown files in the local workspace and recomputed their SHA-256 hashes. Every digest matches the reference JSON.
- Independently parsed the source JSON and asserted batch numbering 1–5, four stocks per batch, 20 unique selected stocks, 24 unique first-event identities and 15/9/11/4 outcome counts. Local source-diagnostic verification passed.
- Strengthened the diagnostic identity test to count unique identity tuples directly, rather than comparing the event list against itself.
- The GitHub commit workflow-run query still returned **zero** PR runs. Vercel deployment statuses were successful, but these are **not GitHub Actions test results**.
- No authorized raw daily OHLCV rows or verified provider research license were present in the recovered five diagnostic attachments. Consequently an independent raw-bar replay was not performed. This remains a hard acceptance blocker.

## GitHub Actions audit #80 — verified from user-shared run listing (2026-10-25)
- Workflow: `Dual Surge Research Safety Audit`, run **#80**, commit `80d95d8`, status **completed successfully**, duration 30 seconds, on the research branch.
- This supersedes the older statement above that no full CI pass was verified. The workflow includes dependency installation, `npx tsc --noEmit --pretty false`, and `node --test tests/research/dualSurge*.test.mjs`. The user-shared overall successful status establishes the workflow result; individual test counts were not independently retrieved.
- The observed 11 positive / 15 matured (73.3%) is a **retrospective positive-outcome fraction in a curated sample**, **not** a predictive win rate, validated precision, expected profit, or statistically representative estimate. The 9 pending records must not be silently counted as wins or losses.
- Remaining STEP 140 blockers: independently licensed raw OHLCV source rows, explicit permission/provenance, reproducible independent replay, and prospective out-of-sample validation. **STEP 140 NOT COMPLETE; production approval NO.**
- Do not merge this Draft PR, schedule collection, place trades, or activate notifications based on the audit pass.
