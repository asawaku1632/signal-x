# Forward outcome immutability — CI evidence (2026-10-28)

## Verified
- GitHub Actions run #316: 188 tests passed, 0 failed, 0 skipped.
- The isolated PostgreSQL integration test executes the exact proposed SQL from `app/lib/learning/immutablePatternForwardSqlResearch.mjs`.
- Replaying the same observation with entry price 120 after initial price 100 leaves entry_price=100, original direction, confidence, and pattern score intact.
- Adding a five-day outcome saves return, outcome date, and direction-sensitive success.
- Replaying a different five-day outcome does not overwrite the first saved outcome.

## Explicit limits
- The test uses a temporary table and synthetic values, not a production table or actual market data.
- Existing `savePatternForwardObservations` still uses ON CONFLICT DO UPDATE for entry_price. The production overwrite risk remains.
- A later correction to an erroneous outcome would require an explicitly audited correction mechanism; the proposed first-write-wins SQL rejects all replacements.
- Historical data still needs source-provenance and as-of-time verification before learning or ranking changes.
- No live AI POWER, alerts, DB schema, or production routes were modified.

CI: https://github.com/asawaku1632/signal-x/actions/runs/40680899350
