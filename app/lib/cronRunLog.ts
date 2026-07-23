import pool from "./postgres";

export type CronRunStatus =
  | "STARTED"
  | "RANKING_SUCCESS"
  | "LINE_SUCCESS"
  | "LINE_FAILED"
  | "SKIPPED"
  | "ERROR";

type SaveCronRunLogInput = {
  route: string;
  status: CronRunStatus;
  message?: string;
  httpStatus?: number;
  details?: unknown;
};

let tableReadyPromise: Promise<void> | null = null;

function ensureCronRunLogsTable(): Promise<void> {
  if (!tableReadyPromise) {
    tableReadyPromise = (async () => {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS cron_run_logs (
          id BIGSERIAL PRIMARY KEY,
          route TEXT NOT NULL,
          status TEXT NOT NULL,
          message TEXT,
          http_status INTEGER,
          details JSONB,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `);

      await pool.query(`
        CREATE INDEX IF NOT EXISTS cron_run_logs_created_at_idx
        ON cron_run_logs (created_at DESC)
      `);

      await pool.query(`
        CREATE INDEX IF NOT EXISTS cron_run_logs_route_idx
        ON cron_run_logs (route)
      `);
    })().catch((error) => {
      tableReadyPromise = null;
      throw error;
    });
  }

  return tableReadyPromise;
}

export async function saveCronRunLog(input: SaveCronRunLogInput) {
  try {
    await ensureCronRunLogsTable();

    const result = await pool.query(
      `
        INSERT INTO cron_run_logs (
          route,
          status,
          message,
          http_status,
          details
        )
        VALUES ($1, $2, $3, $4, $5)
        RETURNING
          id,
          route,
          status,
          message,
          http_status,
          details,
          created_at
      `,
      [
        input.route,
        input.status,
        input.message ?? null,
        input.httpStatus ?? null,
        input.details ? JSON.stringify(input.details) : null,
      ]
    );

    return result.rows[0];
  } catch (error) {
    console.error("Failed to save cron run log:", error);

    return {
      logSaveFailed: true,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}