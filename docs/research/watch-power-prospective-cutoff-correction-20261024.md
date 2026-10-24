# Prospective WATCH holdout cutoff correction — 2026-10-24

**Freeze date: 2026-10-24 (Saturday). Earliest eligible signal date: 2026-10-26 (Monday).**

The initial evaluator used `trainingEndDate: 2026-10-16`, which would have admitted Oct 19–23 observations already available at the Oct 24 freeze. These observations cannot be called truly prospective. Updated `watchPowerHoldout.ts` to `trainingEndDate: 2026-10-24` and version `watch-power-low-vs-high-20261024-v2`, preserving the previously declared comparison bands (<68 versus >=71), 5-session horizon, and minimum 10 comparable future dates. The adapter's documented read-only SQL cutoff and regression tests were aligned.

The 397 WATCH observations from Oct 19–23 remain useful for retrospective diagnostics only; they must never contribute to v2 prospective performance. No post-freeze 5-day outcome is available as of freeze day. Missing returns are not scored as zero. No live decisions, notifications, trading, schedules, database schema, or production deployments changed.

Note: v1 was not a valid prospective cutoff; its previously passing unit tests demonstrated implementation consistency, not prospective validity. New v2 tests require a fresh CI pass before marking validated.
