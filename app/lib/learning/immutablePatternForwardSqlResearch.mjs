// Research-only SQL contract for a prospective fix. Not imported into live Scan.
export const immutablePatternForwardInsertSql = `
  INSERT INTO pattern_forward_observations
  (trade_date, code, pattern_id, pattern_name, direction, entry_price, confidence, pattern_score)
  VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
  ON CONFLICT (trade_date, code, pattern_id) DO NOTHING
  RETURNING code
`;

// Explicit result-only update: deliberately cannot modify initial features,
// direction, entry_price or the original observation time.
export const immutablePatternForwardResultUpdateSql = `
  UPDATE pattern_forward_observations
  SET return_5d = $4, outcome_5d_date = $5,\n      success_5d = CASE\n        WHEN direction = 'BUY' THEN $4 > 0\n        WHEN direction = 'SELL' THEN $4 < 0\n        ELSE NULL END,\n      updated_at = NOW()
  WHERE trade_date = $1 AND code = $2 AND pattern_id = $3
    AND return_5d IS NULL AND outcome_5d_date IS NULL
  RETURNING code
`;
