alter table public.momentum_memory_forward_stats
 add column if not exists notification_validation_status text not null default 'COLLECTING',
 add column if not exists notification_status_reason text;

comment on column public.momentum_memory_forward_stats.notification_validation_status is 'Independent validation status for returns measured from actual admin Web Push notification price';
comment on column public.momentum_memory_forward_stats.notification_status_reason is 'Reason for notification-price validation status';