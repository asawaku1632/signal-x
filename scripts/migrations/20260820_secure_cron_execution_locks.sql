-- Keep the server-internal cron lock table inaccessible to public Data API roles.
ALTER TABLE public.cron_execution_locks ENABLE ROW LEVEL SECURITY;

REVOKE ALL PRIVILEGES ON TABLE public.cron_execution_locks
FROM PUBLIC, anon, authenticated;

-- SIGNALX connects through DATABASE_URL as the postgres database role.
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.cron_execution_locks TO postgres;
