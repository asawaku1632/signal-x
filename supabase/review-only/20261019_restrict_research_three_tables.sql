-- SECURITY REVIEW ONLY: do not apply automatically to production.
-- Supabase dev project was tested separately; production DATABASE_URL role is still unverified.
-- Intended only for three owner-only research tables, no data deletion.
BEGIN;
ALTER TABLE public.entry_time_shadow_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_judgment_fixed_cohort_observations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.broad_ai_research_snapshots ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE
  public.entry_time_shadow_runs,
  public.ai_judgment_fixed_cohort_observations,
  public.broad_ai_research_snapshots
FROM PUBLIC, anon, authenticated;
-- No GRANT to postgres: the table owner already retains its rights.
-- Do not revoke service_role here; review its usage separately.
COMMIT;
