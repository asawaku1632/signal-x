alter table public.momentum_memory_forward_stats
 add column if not exists distinct_codes int not null default 0,
 add column if not exists distinct_dates int not null default 0,
 add column if not exists validation_status text not null default 'COLLECTING',
 add column if not exists status_reason text;

create index if not exists momentum_memory_forward_status_idx
 on public.momentum_memory_forward_stats(validation_status,signal_version);

revoke all on public.momentum_memory_forward_stats from anon,authenticated;
grant select,insert,update,delete on public.momentum_memory_forward_stats to service_role;