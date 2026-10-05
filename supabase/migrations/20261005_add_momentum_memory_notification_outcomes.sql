alter table public.momentum_memory_notifications
 add column if not exists return_1d numeric,
 add column if not exists return_3d numeric,
 add column if not exists return_5d numeric,
 add column if not exists outcome_1d_date date,
 add column if not exists outcome_3d_date date,
 add column if not exists outcome_5d_date date,
 add column if not exists outcomes_updated_at timestamptz;

comment on column public.momentum_memory_notifications.return_1d is 'Return from captured notification price to first subsequent available daily stock result';
comment on column public.momentum_memory_notifications.return_3d is 'Return from captured notification price to third subsequent available daily stock result';
comment on column public.momentum_memory_notifications.return_5d is 'Return from captured notification price to fifth subsequent available daily stock result';