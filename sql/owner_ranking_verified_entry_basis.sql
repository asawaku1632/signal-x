-- Explicit per-capture certification; no automated promotion from staging.
-- A qualified reviewer must verify quote provenance, split/dividend adjustment
-- and consistent entry/exit adjustment version before inserting a row.
CREATE TABLE IF NOT EXISTS owner_ranking_verified_entry_basis (
 capture_id BIGINT NOT NULL REFERENCES owner_ranking_forward_captures(id),
 code TEXT NOT NULL,
 raw_entry_price NUMERIC NOT NULL CHECK (raw_entry_price > 0),
 entry_adjustment_factor NUMERIC NOT NULL CHECK (entry_adjustment_factor > 0),
 adjusted_entry_price NUMERIC GENERATED ALWAYS AS
   (raw_entry_price * entry_adjustment_factor) STORED,
 adjustment_version TEXT NOT NULL,
 corporate_actions_verified BOOLEAN NOT NULL DEFAULT FALSE,
 quote_provenance_verified BOOLEAN NOT NULL DEFAULT FALSE,
 verified_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 evidence JSONB NOT NULL DEFAULT '{}'::jsonb,
 PRIMARY KEY (capture_id, code),
 CHECK (NOT (corporate_actions_verified AND quote_provenance_verified)
        OR (evidence ? 'entry_quote_source' AND evidence ? 'corporate_action_source'
            AND evidence ? 'verified_by'))
);
REVOKE ALL ON owner_ranking_verified_entry_basis FROM PUBLIC;
