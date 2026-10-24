# Daily swing observation coverage (read-only check, 2026-10-24)

Production `public.swing_universe_observations` has 11 recorded trade dates from 2026-10-08 through 2026-10-23, 950 rows per date, totaling 10,450 rows. Recorded dates: 10/08, 10/09, 10/13, 10/14, 10/15, 10/16, 10/19, 10/20, 10/21, 10/22, 10/23. The daily series omits 10/12 (Japan market holiday).

This establishes capture coverage only, not 10-day outcome maturity or accuracy. The attempted finer per-status maturity query did not complete due to access safety checks. Prior read-only confirmed 10-day matured WATCH=49 and AVOID=809 from one frozen assessment date. Do not interpret 11 capture days as 11 independent mature 10-day outcome cohorts.

Next: as data matures, evaluate time-frozen features and next executable-session returns; stratify by distinct signal dates and report missingness. Research-only; no trading rule changes.
