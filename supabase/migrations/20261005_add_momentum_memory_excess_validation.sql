alter table public.momentum_memory_forward_stats
 add column if not exists benchmarked_5d_count integer not null default 0,
 add column if not exists avg_excess_return_5d numeric,
 add column if not exists median_excess_return_5d numeric,
 add column if not exists excess_positive_rate_5d numeric;