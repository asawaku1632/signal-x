CREATE TABLE public.owner_new_buy_events (
 owner_email text NOT NULL,
 code text NOT NULL CHECK(code ~ '^[0-9][0-9A-Z][0-9][0-9A-Z]$'),
 trade_date date NOT NULL,
 name text NOT NULL,
 bar_time bigint NOT NULL,
 reference_price numeric NOT NULL CHECK(reference_price>0),
 detected_at timestamptz NOT NULL DEFAULT now(),
 state text NOT NULL DEFAULT 'PENDING' CHECK(state IN ('PENDING','CLAIMED','SENT','EXPIRED')),
 notified_at timestamptz,
 signals jsonb NOT NULL,
 evidence jsonb NOT NULL,
 PRIMARY KEY(owner_email,code,trade_date)
);
ALTER TABLE public.owner_new_buy_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.owner_new_buy_events FROM PUBLIC,anon,authenticated;
