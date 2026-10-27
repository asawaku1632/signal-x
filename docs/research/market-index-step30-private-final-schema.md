# STEP 30 — Dev-only private finalization schema specification

Status: DESIGN COMPLETE; persistent table NOT CREATED.

Use a private schema not exposed by the Supabase Data API. Proposed table: `market_index_private.daily_final` with `index_key` (nikkei/topix), `session_date` (exchange trading date), `source_run_id`, `provider_id`, `observed_at`, `finalized_at`, and `rights_evidence_id`. Enforce `UNIQUE(index_key,session_date)`, non-null source reference and eligibility constraints. No fake price or unavailable observation may be finalized. Keep observation attempts in `public.market_index_research_runs`. No schedule or production access. Validate provider rights and Japanese trading calendar before implementation. Private schema privileges, RLS, and migrations require review before persistent deployment.
