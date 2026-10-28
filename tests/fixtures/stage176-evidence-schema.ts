// Schema contract for isolated development tests only.
// Do not apply to production or run automatically in application code.
export const ISOLATED_EVIDENCE_DDL = `
CREATE TABLE public.research_evidence_envelopes (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  research_id text NOT NULL,
  rule_version text NOT NULL,
  digest char(64) NOT NULL,
  envelope jsonb NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT evidence_unique_digest UNIQUE (research_id,rule_version,digest),
  CONSTRAINT digest_lower_hex CHECK (digest ~ '^[0-9a-f]{64}$')
);
CREATE FUNCTION public.reject_evidence_mutation() RETURNS trigger LANGUAGE plpgsql AS $ BEGIN RAISE EXCEPTION 'IMMUTABLE_EVIDENCE_HISTORY'; END; $;
CREATE TRIGGER evidence_no_update_delete BEFORE UPDATE OR DELETE ON public.research_evidence_envelopes FOR EACH ROW EXECUTE FUNCTION public.reject_evidence_mutation();
ALTER TABLE public.research_evidence_envelopes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.research_evidence_envelopes FROM PUBLIC;
`;
