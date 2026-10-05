alter table public.momentum_memory_forward_stats
 add column if not exists distinct_months integer not null default 0,
 add column if not exists distinct_market_patterns integer not null default 0;