// CI fixture only; NEVER run against production.
export const AUDIT_PROGRESS_FIXTURE_SQL=`
CREATE TABLE public.test_research_audit_progress(
 audit_id text PRIMARY KEY,
 rule_version text NOT NULL,
 eligible_at_start integer NOT NULL CHECK(eligible_at_start>=0),
 inspected integer NOT NULL DEFAULT 0 CHECK(inspected>=0),
 issue_count integer NOT NULL DEFAULT 0 CHECK(issue_count>=0),
 cursor_date date,
 cursor_code text,
 snapshot_fingerprint text NOT NULL,
 completed boolean NOT NULL DEFAULT false,
 updated_at timestamptz NOT NULL DEFAULT now(),
 CHECK(inspected<=eligible_at_start),
 CHECK(issue_count<=inspected),
 CHECK(inspected=0 OR (cursor_date IS NOT NULL AND cursor_code IS NOT NULL)),
 CHECK(NOT completed OR inspected=eligible_at_start)
);
REVOKE ALL ON public.test_research_audit_progress FROM PUBLIC;
`;
