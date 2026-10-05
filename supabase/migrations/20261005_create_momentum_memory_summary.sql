create or replace view public.momentum_memory_summary
with (security_invoker = true)
as
select
  count(*) filter (where observation_flag) as observed_count,
  count(result_1d) filter (where observation_flag) as sample_1d,
  round(avg(result_1d) filter (where observation_flag), 4) as avg_return_1d,
  round(100.0 * count(*) filter (where observation_flag and result_1d > 0)
    / nullif(count(result_1d) filter (where observation_flag), 0), 2) as positive_rate_1d,
  count(result_3d) filter (where observation_flag) as sample_3d,
  round(avg(result_3d) filter (where observation_flag), 4) as avg_return_3d,
  round(100.0 * count(*) filter (where observation_flag and result_3d > 0)
    / nullif(count(result_3d) filter (where observation_flag), 0), 2) as positive_rate_3d,
  count(result_5d) filter (where observation_flag) as sample_5d,
  round(avg(result_5d) filter (where observation_flag), 4) as avg_return_5d,
  round(100.0 * count(*) filter (where observation_flag and result_5d > 0)
    / nullif(count(result_5d) filter (where observation_flag), 0), 2) as positive_rate_5d
from public.momentum_memory_observations;

revoke all on public.momentum_memory_summary from anon, authenticated;
grant select on public.momentum_memory_summary to service_role;