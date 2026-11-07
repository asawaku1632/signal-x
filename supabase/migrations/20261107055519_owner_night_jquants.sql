CREATE TABLE public.owner_night_jquants (
 owner_email text NOT NULL,
 trade_date date NOT NULL,
 state text NOT NULL DEFAULT 'PENDING' CHECK(state IN ('PENDING','FETCHING','READY','CLAIMED','NOTIFIED')),
 run_id uuid,
 updated_at timestamptz NOT NULL DEFAULT now(),
 analyzed_at timestamptz,
 notified_at timestamptz,
 universe_count integer NOT NULL DEFAULT 0,
 evaluated_count integer NOT NULL DEFAULT 0,
 excluded_count integer NOT NULL DEFAULT 0,
 candidates jsonb NOT NULL DEFAULT '[]',
 note text,
 PRIMARY KEY(owner_email,trade_date)
);
ALTER TABLE public.owner_night_jquants ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.owner_night_jquants FROM PUBLIC,anon,authenticated;