-- DRAFT ONLY. NOT APPLIED. Review license, retention, and auth before executing.
-- Dedicated schema keeps the research table out of public Data API by default.
begin;
create schema if not exists morning_quote_research;
revoke all on schema morning_quote_research from public, anon, authenticated;
create table if not exists morning_quote_research.quote_diagnostics (
  id bigint generated always as identity primary key,
  research_run_date date not null,
  stage text not null check (stage in ('existing_response','upstream_failure','parser_failure')),
  reason text not null check (reason in (
    'UPSTREAM_HTTP_ERROR','UPSTREAM_TIMEOUT','JSON_PARSE_ERROR','CLASSIFIER_ERROR',
    'PROVIDER_CHART_ERROR','NO_RESULT','NO_TIMESTAMP_ARRAY','NO_QUOTE_ARRAY',
    'MISSING_0900_BAR','MISSING_0905_BAR','BARS_PRESENT_NOT_PRICE_VALIDATED')),
  http_status_class text not null check (http_status_class in ('2xx','3xx','4xx','5xx','unknown')),
  timestamp_count integer check (timestamp_count between 0 and 75),
  has_0900 boolean,
  has_0905 boolean,
  classifier_version text not null check (length(classifier_version) between 1 and 32),
  recorded_at timestamptz not null default now(),
  check (stage <> 'upstream_failure' or (has_0900 is null and has_0905 is null))
);
alter table morning_quote_research.quote_diagnostics enable row level security;
revoke all on morning_quote_research.quote_diagnostics from public, anon, authenticated;
revoke all on sequence morning_quote_research.quote_diagnostics_id_seq from public, anon, authenticated;
-- Intentionally no client policies, no grants, no scheduled writes.
-- A privileged service connection may bypass RLS: guard the server entry point separately.
commit;
