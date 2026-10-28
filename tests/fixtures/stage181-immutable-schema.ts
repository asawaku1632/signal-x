// Disposable PostgreSQL only. Defense in depth for evidence history.
export const IMMUTABLE_EVIDENCE_DDL = `
CREATE OR REPLACE FUNCTION public.reject_research_evidence_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'EVIDENCE_IMMUTABLE'; END;
$$;
CREATE TRIGGER research_evidence_no_update_delete
BEFORE UPDATE OR DELETE ON public.research_evidence_envelopes
FOR EACH ROW EXECUTE FUNCTION public.reject_research_evidence_mutation();
`;
