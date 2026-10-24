-- SECURITY REVIEW ONLY: production migration must not run until DATABASE_URL role and research jobs are verified.
-- Tested on isolated development Supabase project on 2026-10-19.
-- No rows deleted, no AI/trading/notification behavior changed.
BEGIN;
REVOKE ALL PRIVILEGES ON TABLE
  public.entry_time_shadow_runs,
  public.ai_judgment_fixed_cohort_observations,
  public.broad_ai_research_snapshots
FROM anon, authenticated;

ALTER TABLE public.entry_time_shadow_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_judgment_fixed_cohort_observations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.broad_ai_research_snapshots ENABLE ROW LEVEL SECURITY;
COMMIT;
