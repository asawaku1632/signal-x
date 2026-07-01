import pool from "@/app/lib/postgres";

export async function saveVerificationLog({
  status,
  stockCount,
  missingCount,
  validCode,
  validName,
  validPrice,
  validScore,
  validReason,
  errorCount,
  scanMs,
  debugVersion,
}: {
  status: string;
  stockCount: number;
  missingCount: number;
  validCode: number;
  validName: number;
  validPrice: number;
  validScore: number;
  validReason: number;
  errorCount: number;
  scanMs: number;
  debugVersion: string;
}) {
  await pool.query(
    `
    INSERT INTO verification_logs
    (
      status,
      stock_count,
      missing_count,
      valid_code,
      valid_name,
      valid_price,
      valid_score,
      valid_reason,
      error_count,
      scan_ms,
      debug_version
    )
    VALUES
    (
      $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11
    )
    `,
    [
      status,
      stockCount,
      missingCount,
      validCode,
      validName,
      validPrice,
      validScore,
      validReason,
      errorCount,
      scanMs,
      debugVersion,
    ]
  );
}

export async function getVerificationLogs(limit = 30) {
  const result = await pool.query(
    `
    SELECT *
    FROM verification_logs
    ORDER BY created_at DESC
    LIMIT $1
    `,
    [limit]
  );

  return result.rows;
}