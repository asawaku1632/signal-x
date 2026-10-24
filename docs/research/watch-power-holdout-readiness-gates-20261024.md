# WATCH low-vs-high prospective holdout readiness gates

Research-only pure function: `app/lib/learning/watchPowerHoldoutReadiness.ts`.

- `COLLECTING`: fewer than 10 comparable **post-freeze** signal dates; never display preliminary date-equal-weight differences as decision-ready.
- `DATA_CONFLICT`: at least one conflicting duplicate stock/date record; review blocked regardless of number of dates.
- `REVIEW_READY`: at least 10 comparable signal dates and no duplicate conflicts. This only permits human research review, **not** claims of statistical significance or trading advantage.
- Dates with missing five-session outcomes are tracked separately. Missing outcomes never count as 0% return. Dates without both low (<68) and high (>=71) groups are not comparable.
- Historical dates on/before October 24, 2026 are excluded. First eligible session is Monday, October 26.

No scheduler, cron, database access, API route, public UI, live trading signal, or notification was added. This function must be fed owner-authorized, read-only records; automatic polling and production connection require separate authorization and verification. Tests and CI confirmation are pending.
