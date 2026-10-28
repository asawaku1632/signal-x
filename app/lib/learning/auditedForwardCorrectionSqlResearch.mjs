// Research-only correction contract. Never imported by production code.
// Caller must BEGIN a transaction and create the two temporary tables in the
// isolated integration test. Production adoption needs an access-control review.
export const auditedForwardCorrectionSql = `
WITH locked AS (
 SELECT trade_date,code,pattern_id,direction,return_5d,outcome_5d_date,success_5d
 FROM pattern_forward_observations
 WHERE trade_date=$1::date AND code=$2 AND pattern_id=$3
   AND return_5d IS NOT NULL AND outcome_5d_date IS NOT NULL
 FOR UPDATE
), written_audit AS (
 INSERT INTO pattern_forward_correction_audit
 (trade_date,code,pattern_id,old_return_5d,old_outcome_5d_date,
  old_success_5d,new_return_5d,new_outcome_5d_date,new_success_5d,
  correction_reason,actor_id)
 SELECT trade_date,code,pattern_id,return_5d,outcome_5d_date,success_5d,
  $4::numeric,$5::date,
  CASE WHEN direction='BUY' THEN $4::numeric>0
       WHEN direction='SELL' THEN $4::numeric<0 ELSE NULL END,
  $6::text,$7::text
 FROM locked
 WHERE length(trim($6::text)) >= 10
   AND length(trim($7::text)) >= 3
   AND (return_5d IS DISTINCT FROM $4::numeric
        OR outcome_5d_date IS DISTINCT FROM $5::date)
 RETURNING trade_date,code,pattern_id
)
UPDATE pattern_forward_observations p
SET return_5d=$4::numeric, outcome_5d_date=$5::date,
 success_5d=CASE WHEN p.direction='BUY' THEN $4::numeric>0
                 WHEN p.direction='SELL' THEN $4::numeric<0 ELSE NULL END,
 updated_at=NOW()
FROM written_audit a
WHERE p.trade_date=a.trade_date AND p.code=a.code AND p.pattern_id=a.pattern_id
RETURNING p.entry_price,p.direction,p.return_5d,p.success_5d
`;
