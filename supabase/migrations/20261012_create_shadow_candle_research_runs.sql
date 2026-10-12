-- Research-only archive; it does NOT participate in production scans,
-- LINE notifications, user portfolio, AI POWER or training stats.
-- Applied only after the pull request's safety/CI checks pass.
create table if not exists public.shadow_candle_research_runs (
  id uuid primary key default gen_random_uuid(),
  detector_version text not null check (detector_version ~ '^CANDLE9_V[0-9]+$'),
  batch_key text not null check (char_length(batch_key) between 4 and 120),
  input_hash text not null unique check (input_hash ~ '^[0-9a-f]{64}$'),
  codes text[] not null,
  requested_count integer not null check (requested_count between 1 and 5),
  succeeded_count integer not null check (succeeded_count between 1 and requested_count),
  first_bar_date date not null,
  last_bar_date date not null check (last_bar_date >= first_bar_date),
  source text not null default 'YAHOO_CHART_1D' check (source = 'YAHOO_CHART_1D'),
  aggregate jsonb not null check (jsonb_typeof(aggregate) = 'object'),
  events jsonb not null check (jsonb_typeof(events) = 'array'),
  excluded jsonb not null check (jsonb_typeof(excluded) = 'array'),
  created_at timestamptz not null default now()
);
create index if not exists shadow_candle_research_runs_created_idx
  on public.shadow_candle_research_runs (created_at desc);

alter table public.shadow_candle_research_runs enable row level security;
revoke all on table public.shadow_candle_research_runs from public, anon, authenticated;
grant select, insert on table public.shadow_candle_research_runs to service_role;

-- No UPDATE or DELETE permissions are granted to service_role;
-- identical requests are deduplicated with ON CONFLICT DO NOTHING.
