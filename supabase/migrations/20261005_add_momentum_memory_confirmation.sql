alter table public.momentum_memory_observations
 add column if not exists confirmation_key text,
 add column if not exists confirmation_score smallint not null default 0;

with features as (
 select m.id,
        p.macd_key,p.rsi_band,p.ema20_key,
        mk.market_pattern
 from public.momentum_memory_observations m
 left join lateral (
  select macd_key,rsi_band,ema20_key
  from public.pattern_learning_logs p
  where p.code=m.code and p.trade_date=m.trade_date
  order by p.created_at desc limit 1
 ) p on true
 left join public.market_learning_logs mk on mk.trade_date=m.trade_date
)
update public.momentum_memory_observations m
set confirmation_key=case
 when f.macd_key='MACD_GC' then 'MACD_GC'
 else 'NONE' end,
 confirmation_score=case when f.macd_key='MACD_GC' then 1 else 0 end,
 updated_at=now()
from features f where m.id=f.id and m.observation_flag=true;

create index if not exists momentum_memory_confirmation_date_idx
 on public.momentum_memory_observations(confirmation_key,trade_date desc);

create or replace view public.momentum_memory_confirmed_summary
with (security_invoker=true) as
select profile_key,confirmation_key,
 count(result_5d) sample_5d,
 round(avg(result_5d),4) avg_return_5d,
 round(percentile_cont(.5) within group(order by result_5d)::numeric,4) median_return_5d,
 round(100.0*count(*) filter(where result_5d>0)/nullif(count(result_5d),0),2) positive_rate_5d
from public.momentum_memory_observations
where observation_flag=true and result_5d is not null
group by profile_key,confirmation_key;

revoke all on public.momentum_memory_confirmed_summary from anon,authenticated;
grant select on public.momentum_memory_confirmed_summary to service_role;