-- Owner-controlled research-only activation switch.
-- No public read/write; the cron fails closed when this is missing or OFF.
CREATE TABLE IF NOT EXISTS public.shadow_candle_auto_control (
  id boolean PRIMARY KEY DEFAULT true CHECK (id=true),
  enabled boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.shadow_candle_auto_control ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.shadow_candle_auto_control FROM public, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.shadow_candle_auto_control TO service_role;
INSERT INTO public.shadow_candle_auto_control (id, enabled)
VALUES (true, false) ON CONFLICT (id) DO NOTHING;
