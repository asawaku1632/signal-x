CREATE TABLE public.owner_downtrend_watch (
 owner_email text NOT NULL,
 code text NOT NULL,
 name text NOT NULL,
 state text NOT NULL DEFAULT 'ARMED' CHECK(state IN ('ARMED','CLAIMED','NOTIFIED')),
 last_bar bigint,
 clear_count integer NOT NULL DEFAULT 0,
 checked_at timestamptz,
 notified_at timestamptz,
 observation jsonb,
 PRIMARY KEY(owner_email,code)
);
ALTER TABLE public.owner_downtrend_watch ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.owner_downtrend_watch FROM PUBLIC,anon,authenticated;