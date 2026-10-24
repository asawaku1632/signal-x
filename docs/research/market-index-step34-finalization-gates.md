# STEP 34 — Daily-finalization implementation gates

Status: design review complete; persistent schema NOT installed.

- Do not finalize missing-provider placeholders: `status='unavailable'` and `provider_rights_verified=false` are ineligible.
- Require authorized provider evidence, source timestamp, trading-session date from a verified Japanese market calendar and non-null observation.
- Store append-only attempts separately from a private final table with DB-enforced `UNIQUE(index_key,session_date)`.
- First-writer-wins only for verified eligible data; corrections must use an explicit audited revision path.
- Never add a daily uniqueness constraint to the attempt-history table.
- Prior to dev-only schema creation, verify private schema permissions, RLS and security advisors; do not expose the table to the public Data API.
- Production writes, scheduler, AI POWER, notifications and orders remain disabled.
