alter table public.momentum_memory_notifications
 add column if not exists notification_price numeric,
 add column if not exists price_captured_at timestamptz,
 add column if not exists price_source text,
 add column if not exists profile_key text,
 add column if not exists ai_power numeric,
 add column if not exists prev3_avg_ai_power numeric,
 add column if not exists ai_power_drop_from_peak numeric;

comment on column public.momentum_memory_notifications.notification_price is 'Market quote captured immediately before admin Web Push; null when quote unavailable';
comment on column public.momentum_memory_notifications.price_captured_at is 'Timestamp when notification_price was fetched';
comment on column public.momentum_memory_notifications.price_source is 'Source used for notification_price';