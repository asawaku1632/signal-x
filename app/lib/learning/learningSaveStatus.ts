import pool from "@/app/lib/postgres";

const SAVE_ROUTE = "/api/learning/save-daily";

type SaveLogRow = {
  status?: string;
  message?: string;
  http_status?: number;
  details?: Record<string, unknown> | null;
  created_at?: Date | string;
};

function toNumber(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function toIsoString(value: unknown) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export function getJstDateString(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function getJstWeekday(date = new Date()) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Tokyo",
    weekday: "short",
  }).format(date);
}

export function isJstBusinessDay(date = new Date()) {
  const weekday = getJstWeekday(date);
  return weekday !== "Sat" && weekday !== "Sun";
}

function getPreviousWeekday(date = new Date()) {
  const cursor = new Date(date);

  do {
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  } while (!isJstBusinessDay(cursor));

  return getJstDateString(cursor);
}

function mapLog(row?: SaveLogRow) {
  if (!row) return null;

  return {
    status: String(row.status ?? "UNKNOWN"),
    message: row.message ? String(row.message) : null,
    httpStatus: row.http_status ?? null,
    details: row.details ?? null,
    createdAt: toIsoString(row.created_at),
  };
}

export async function getLearningSaveStatus() {
  const today = getJstDateString();
  const businessDay = isJstBusinessDay();
  const previousBusinessDay = getPreviousWeekday();

  const [summaryResult, todayResult, latestCronResult, lastErrorResult] =
    await Promise.all([
      pool.query(`
        SELECT
          MAX(date) AS latest_saved_date,
          (
            SELECT MAX(confirmed.date)
            FROM (
              SELECT date
              FROM daily_stock_results
              WHERE date IS NOT NULL
              GROUP BY date
              HAVING COUNT(*) FILTER (WHERE result = 'UNKNOWN') = 0
            ) AS confirmed
          ) AS latest_confirmed_date
        FROM daily_stock_results
      `),
      pool.query(
        `
          SELECT
            COUNT(*)::int AS saved_count,
            COUNT(*) FILTER (
              WHERE result IN ('WIN', 'LOSE', 'HOLD')
            )::int AS judged_count,
            COUNT(*) FILTER (WHERE result = 'UNKNOWN')::int AS unknown_count
          FROM daily_stock_results
          WHERE date = $1
        `,
        [today],
      ),
      pool.query(
        `
          SELECT status, message, http_status, details, created_at
          FROM cron_run_logs
          WHERE route = $1
            AND status IN ('COMPLETED', 'ERROR')
          ORDER BY created_at DESC
          LIMIT 1
        `,
        [SAVE_ROUTE],
      ),
      pool.query(
        `
          SELECT status, message, http_status, details, created_at
          FROM cron_run_logs
          WHERE route = $1
            AND status = 'ERROR'
          ORDER BY created_at DESC
          LIMIT 1
        `,
        [SAVE_ROUTE],
      ),
    ]);

  const summary = summaryResult.rows[0] ?? {};
  const todayStats = todayResult.rows[0] ?? {};
  const latestSavedDate = summary.latest_saved_date
    ? String(summary.latest_saved_date).slice(0, 10)
    : null;
  const latestConfirmedDate = summary.latest_confirmed_date
    ? String(summary.latest_confirmed_date).slice(0, 10)
    : null;
  const savedCount = toNumber(todayStats.saved_count);
  const judgedCount = toNumber(todayStats.judged_count);
  const unknownCount = toNumber(todayStats.unknown_count);
  const latestCron = mapLog(latestCronResult.rows[0]);
  const lastError = mapLog(lastErrorResult.rows[0]);
  const latestCronTime = latestCron?.createdAt
    ? new Date(latestCron.createdAt).getTime()
    : 0;
  const lastErrorTime = lastError?.createdAt
    ? new Date(lastError.createdAt).getTime()
    : 0;
  const unresolvedError = Boolean(
    lastError && (!latestCron || lastErrorTime >= latestCronTime),
  );
  const scanFailed =
    unresolvedError &&
    (lastError?.details?.stage === "scan" ||
      lastError?.details?.stage === "scan-response");
  const cronFailed = latestCron?.status === "ERROR";
  const cronMissing = businessDay && !latestCron;
  const missingToday = businessDay && savedCount === 0;
  const staleSavedDate =
    businessDay &&
    (!latestSavedDate || latestSavedDate <= previousBusinessDay);

  const alerts = [
    missingToday ? "営業日ですが、本日の保存件数が0件です" : null,
    staleSavedDate ? "最新保存日が前営業日以前のままです" : null,
    cronFailed ? "保存Cronの最終実行が失敗しています" : null,
    cronMissing ? "保存Cronの実行履歴がありません" : null,
    scanFailed ? "scan取得に失敗しています" : null,
  ].filter((message): message is string => Boolean(message));

  return {
    checkedAt: new Date().toISOString(),
    today,
    isBusinessDay: businessDay,
    previousBusinessDay,
    latestSavedDate,
    latestConfirmedDate,
    savedToday: savedCount > 0,
    savedCount,
    judgedCount,
    unknownCount,
    latestCron,
    lastError,
    health: alerts.length > 0 ? "error" : "ok",
    alerts,
  };
}
