CREATE TABLE public.owner_new_buy_outcomes (
 owner_email text NOT NULL,
 code text NOT NULL,
 trade_date date NOT NULL,
 horizon smallint NOT NULL CHECK(horizon IN (1,3,5)),
 target_date date NOT NULL,
 required_dates date[] NOT NULL,
 status text NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING','COMPLETE','DATA_MISSING','CORPORATE_ACTION_REVIEW','INVALID_EVENT')),
 close_price numeric,
 return_pct numeric,
 evidence jsonb,
 note text,
 last_attempt_at timestamptz,
 completed_at timestamptz,
 PRIMARY KEY(owner_email,code,trade_date,horizon),
 FOREIGN KEY(owner_email,code,trade_date) REFERENCES public.owner_new_buy_events(owner_email,code,trade_date),
 CHECK(target_date>trade_date),
 CHECK((status='COMPLETE' AND close_price>0 AND return_pct IS NOT NULL) OR (status<>'COMPLETE' AND close_price IS NULL AND return_pct IS NULL))
);
CREATE INDEX owner_new_buy_outcomes_pending ON public.owner_new_buy_outcomes(owner_email,last_attempt_at,target_date)
 WHERE status IN ('PENDING','DATA_MISSING');
ALTER TABLE public.owner_new_buy_outcomes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.owner_new_buy_outcomes FROM PUBLIC,anon,authenticated;
CREATE TABLE public.owner_new_buy_outcome_runs (
 owner_email text PRIMARY KEY,
 run_id uuid NOT NULL,
 run_date date NOT NULL,
 state text NOT NULL CHECK(state IN ('RUNNING','DONE','ERROR')),
 started_at timestamptz NOT NULL,
 finished_at timestamptz,
 stats jsonb,
 note text
);
ALTER TABLE public.owner_new_buy_outcome_runs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.owner_new_buy_outcome_runs FROM PUBLIC,anon,authenticated;
