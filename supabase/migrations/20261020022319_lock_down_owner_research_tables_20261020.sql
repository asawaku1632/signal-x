-- Applied to production via Supabase migration version 20261020022319.
-- Defense in depth for 7 owner-only research tables.
-- Preserve historical observations and server-side postgres/service_role access.
-- No permissions are granted to public clients; no user-facing RLS policies.
-- New owner-only research tables should use RLS and REVOKE at creation time.

BEGIN;

REVOKE ALL ON TABLE
  public.ai_judgment_fixed_cohort_observations,
  public.broad_ai_research_snapshots,
  public.entry_time_shadow_runs,
  public.rebound_forward_control,
  public.rebound_forward_daily_batches,
  public.rebound_forward_stock_checks,
  public.rebound_forward_signals
FROM PUBLIC, anon, authenticated;

ALTER TABLE public.ai_judgment_fixed_cohort_observations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.broad_ai_research_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.entry_time_shadow_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rebound_forward_control ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rebound_forward_daily_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rebound_forward_stock_checks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rebound_forward_signals ENABLE ROW LEVEL SECURITY;

COMMIT;
