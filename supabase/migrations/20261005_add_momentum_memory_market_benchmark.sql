alter table public.momentum_memory_observations
 add column if not exists benchmark_5d numeric,
 add column if not exists excess_return_5d numeric,
 add column if not exists benchmark_key text not null default 'TOPIX';

comment on column public.momentum_memory_observations.benchmark_5d is 'TOPIX return over the same fifth subsequent available market date';
comment on column public.momentum_memory_observations.excess_return_5d is 'result_5d minus benchmark_5d';