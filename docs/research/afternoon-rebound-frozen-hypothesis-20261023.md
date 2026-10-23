# Afternoon rebound: frozen exploratory hypothesis (2026-10-23)

Status: **research only / NOT validated / NOT production-enabled**.

## Discovery dataset and limitations
Read-only audit of production `public.broad_ai_research_snapshots`, seven trading days 2026-10-15 through 2026-10-23. The `time_slot` labels are **not quote timestamps**. Across the stored observations, the actual `quoteTime` windows in JST were approximately 12:39–12:47 for slot 13:00, 14:10–14:17 for slot 14:30, and 14:54–15:03 for slot 15:15. Average quote-to-capture lag was about 18–20 minutes. Do not assume that 14:30-slot quotes were knowable at 14:10.

191 code+trading-day observations had positive numeric prices at all three slots. Of those, 115 declined from 13:00 slot to 14:30 slot. Among the 115, 15 had 14:30-slot AI score 60–79 and 8 had a higher 15:15-slot price (53.3%); 100 had score below 60 and 27 rose (27.0%). No 80+ scores occurred in the 115 declining observations. This is an exploratory, selected, tiny sample and is **not** a forecast, fill rate, or trading win rate. The 60–79 threshold was selected after looking at this dataset, so these observations MUST NOT be reused as independent validation.

## Frozen hypothesis for future out-of-sample study
- Unit: one distinct `trade_date + code`; deduplicate, report exclusions and missing observations.
- Universe: same research cohort captured independently before the decision; do not backfill post-hoc winners.
- Early decline: numeric positive price at 13:00 slot greater than numeric positive price at 14:30 slot.
- Candidate: 14:30-slot score >=60 and <80, with the score and price both demonstrably available by the actual research decision time. Quote timestamp and availability timestamp must be tracked separately. If availability cannot be proved, exclude.
- Outcome: 15:15-slot price strictly greater than 14:30-slot price, only when both observations are timestamped and independently source-approved. Also report actual percentage change, median, missingness, and trading-day breakdown.
- Control: early-decline cohort with 14:30-slot score <60, same source/availability rules.
- Do not change the thresholds based on new outcomes. Report daily and pooled denominators, avoid treating correlated stocks on one day as independent evidence, and retain all negative outcomes.
- No retrospective simulation of 14:10 orders: there is no 14:10 decision-time snapshot or post-decision intraday high/low/fill evidence in these three slot observations.

## Hard gates before execution or product integration
1. Independently establish provenance and written data-use rights for the actual source, including derived/commercial use; owner-only visibility is not a license exception. Existing Yahoo Finance chart reads do not authorize repurposing or retaining intraday market data.
2. Verify that `quoteTime`, `captured_at`, decision-time availability and source are coherent; reject stale, future, duplicate, invalid, or otherwise unlicensed records. The 14:30 slot is **not** a 14:10 decision signal.
3. Implement research-only holdout evaluation, without orders, live alerts, public performance claims, automatic collection, new paid providers, or changes to production scans.
4. Only consider any product change after a separate review of sample size, regime dependence, data rights, costs, and execution realism.

This file freezes the hypothesis only. It does not assert that an automatic study has been enabled or that any future data is licensed for this purpose.
