-- Research-only immutable capture. Apply before enabling scheduled calls.
CREATE TABLE IF NOT EXISTS owner_ranking_forward_captures (
 id BIGSERIAL PRIMARY KEY,
 trade_date_jst DATE NOT NULL,
 slot_jst TEXT NOT NULL CHECK (slot_jst IN ('08:50','09:15','11:30')),
 captured_at TIMESTAMPTZ NOT NULL,
 source_snapshot_at TIMESTAMPTZ NOT NULL,
 records JSONB NOT NULL,
 eligible_count INTEGER NOT NULL CHECK (eligible_count BETWEEN 0 AND 100),
 status TEXT NOT NULL,
 UNIQUE (trade_date_jst, slot_jst)
);
REVOKE ALL ON owner_ranking_forward_captures FROM PUBLIC;
