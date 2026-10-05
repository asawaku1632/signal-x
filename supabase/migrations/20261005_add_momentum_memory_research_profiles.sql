alter table public.momentum_memory_observations
  add column if not exists profile_key text,
  add column if not exists research_score numeric;

update public.momentum_memory_observations
set
  profile_key = case
    when prev3_avg_ai_power >= 95 and prev3_high_count = 2 then 'EXPLOSIVE_REBOUND'
    when current_ai_power >= 30 and current_ai_power < 40 and ai_power_drop_from_peak >= 65 then 'STABLE_REBOUND'
    else 'BASE'
  end,
  research_score = case
    when prev3_avg_ai_power >= 95 and prev3_high_count = 2 then 2
    when current_ai_power >= 30 and current_ai_power < 40 and ai_power_drop_from_peak >= 65 then 1
    else 0
  end
where observation_flag = true;

create index if not exists momentum_memory_profile_date_idx
  on public.momentum_memory_observations (profile_key, trade_date desc);

create or replace view public.momentum_memory_profile_summary
with (security_invoker = true)
as
select profile_key,
 count(*) filter(where observation_flag) sample_count,
 count(result_5d) filter(where observation_flag) sample_5d,
 round(avg(result_5d) filter(where observation_flag),4) avg_return_5d,
 round(percentile_cont(0.5) within group(order by result_5d)
   filter(where observation_flag and result_5d is not null)::numeric,4) median_return_5d,
 round(100.0 * count(*) filter(where observation_flag and result_5d>0)
   / nullif(count(result_5d) filter(where observation_flag),0),2) positive_rate_5d
from public.momentum_memory_observations
where profile_key is not null
group by profile_key;

revoke all on public.momentum_memory_profile_summary from anon, authenticated;
grant select on public.momentum_memory_profile_summary to service_role;