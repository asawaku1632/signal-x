create or replace view public.momentum_memory_notification_summary
with (security_invoker=true) as
select
  coalesce(n.profile_key, m.profile_key) as profile_key,
  m.signal_version,
  count(*) filter (where n.notification_price is not null)::int as captured_count,
  count(n.return_1d)::int as completed_1d_count,
  round(avg(n.return_1d),4) as avg_return_1d,
  count(n.return_3d)::int as completed_3d_count,
  round(avg(n.return_3d),4) as avg_return_3d,
  count(n.return_5d)::int as completed_5d_count,
  round(avg(n.return_5d),4) as avg_return_5d,
  round(percentile_cont(0.5) within group (order by n.return_5d)::numeric,4) as median_return_5d,
  round(100.0 * count(*) filter (where n.return_5d > 0) / nullif(count(n.return_5d),0),2) as positive_rate_5d
from public.momentum_memory_notifications n
join public.momentum_memory_observations m on m.id=n.observation_id
where n.channel='ADMIN_WEB_PUSH'
  and m.validation_mode='FORWARD'
  and m.observation_flag=true
  and m.confirmation_key='MACD_GC'
  and m.profile_key in ('STABLE_REBOUND','EXPLOSIVE_REBOUND')
group by coalesce(n.profile_key,m.profile_key),m.signal_version;

revoke all on public.momentum_memory_notification_summary from anon,authenticated;
grant select on public.momentum_memory_notification_summary to service_role;