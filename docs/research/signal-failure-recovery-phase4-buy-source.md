# Phase 4 — Actual BUY trigger identified (2026-10-21)

Verified:
- app/api/cron/favorite-ai-monitor/route.ts checks TSE cash session, scans favorite stocks, requires score >= FAVORITE_BUY_SCORE, handles ARMED/DISARMED state, and calls startFavoriteAiMonitor before LINE/Web push.
- app/lib/favoriteAiMonitor.ts defines FAVORITE_BUY_SCORE=85 and persists rows to public.favorite_ai_monitors, including triggered_at (DB default), entry_price, ai_power, take_profit, stop_loss, code, name and status. A created monitor is a stronger signal-event source than notification delivery.
- Notification dispatch is conditional and may be suppressed for PRIME, so do not treat push delivery as equivalent to signal creation.
- This source is favorites-only, not a universal buy-signal feed.
- Current route reads /api/scan?limit=1000; freshness and exact quote timestamp provenance are not established from this audit.
- Historical row retention and production DB completeness are not established.

Implementation gate: create an owner-only research adapter that reads existing monitor rows without changing them, de-identifies user_email, validates time/price, and excludes uncertain historical events from definitive cohort. Separate prospective append-only snapshots with quote timestamp and source once verified. Do not modify existing notifications or trading logic.

No production writes or cron changes made.
