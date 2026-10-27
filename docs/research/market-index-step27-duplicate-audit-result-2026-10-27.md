# STEP27 — Manual duplicate audit result (2026-10-27 JST)

## Source and scope
Administrator-provided read-only SQL output from development Supabase project `signal-x-dev` (`jdtqwryiyxeuoraecorw`). The query groups `public.market_index_research_runs` by JST date and `index_key`, filtering `reason = 'PROVIDER_APPROVAL_REQUIRED'`.

## Observed results

| JST date | index_key | saved_count | result |
| --- | --- | ---: | --- |
| 2026-10-27 | nikkei | 1 | OK |
| 2026-10-23 | nikkei | 1 | OK |
| 2026-10-23 | topix | 1 | OK |
| 2026-10-22 | nikkei | 1 | OK |

- Returned groups: **4**
- Groups with one record: **4**
- Groups with more than one record: **0**
- Decision: **PASS for this query's returned development-status groups at the time of execution**.

## Limitations
- Based on the administrator's pasted SQL result; no independent live DB query by this document's author.
- Covers only the filtered unavailable-status reason, not every row or reason in the table.
- Not proof of real index-price accuracy, licensing, future absence of duplicates, or all concurrent execution paths.
- No production DB, production AI, notification, orders, scheduled acquisition, or market-data feed changes authorized.

Related procedures: [read-only duplicate audit](./market-index-step27-readonly-duplicate-audit.sql.md) and [evidence-to-use register](./market-index-step27-evidence-to-use-register-2026-10-27.md).
