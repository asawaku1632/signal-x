import pool from "@/app/lib/postgres";
import {
  classifyLearningSave,
  type MonitorLog,
} from "@/app/lib/learning/learningSaveMonitor";

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

export async function getLearningSaveStatus(now = new Date()) {
  const today = getJstDateString(now);
  const businessDay = isJstBusinessDay(now);
  const previousBusinessDay = getPreviousWeekday(now);
  const [summaryResult, todayResult, logsResult] = await Promise.all([
    pool.query(`SELECT MAX(date) AS latest_saved_date FROM daily_stock_results`),
    pool.query(
      `SELECT COUNT(*)::int AS saved_count,
              COUNT(*) FILTER (WHERE result IN ('WIN','LOSE','HOLD'))::int AS judged_count,
              COUNT(*) FILTER (WHERE result = 'UNKNOWN')::int AS unknown_count
       FROM daily_stock_results WHERE date = $1`,
      [today],
    ),
    pool.query(
      `SELECT status, message, http_status, details, created_at
       FROM cron_run_logs
       WHERE route = $1 AND details->>'targetDate' = $2
       ORDER BY created_at DESC`,
      [SAVE_ROUTE, today],
    ),
  ]);

  const summary = summaryResult.rows[0] ?? {};
  const todayStats = todayResult.rows[0] ?? {};
  const savedCount = toNumber(todayStats.saved_count);
  const logs = logsResult.rows.map(mapLog).filter(Boolean) as NonNullable<
    ReturnType<typeof mapLog>
  >[];
  const monitor = classifyLearningSave({
    savedCount,
    logs: logs as MonitorLog[],
    nowMs: now.getTime(),
  });
  const latestSavedDate = summary.latest_saved_date
    ? String(summary.latest_saved_date).slice(0, 10)
    : null;

  const alertByClassification: Record<string, string> = {
    CRON_NOT_STARTED: "保存CronがAPIへ到達していません",
    SCHEDULER_DELAY: `保存Cronが${Math.floor(monitor.delaySeconds / 60)}分遅延しました`,
    SCAN_FAILED: "Scanまたは保存対象銘柄の取得に失敗しました",
    DB_SAVE_FAILED: "日次スナップショットのDB保存に失敗しました",
    POST_SAVE_FAILED: "日次保存後の関連学習保存に失敗しました",
    CRON_STALLED: "保存Cronが開始後に停止または長時間実行中です",
  };
  const alerts = businessDay && alertByClassification[monitor.classification]
    ? [alertByClassification[monitor.classification]]
    : [];

  return {
    checkedAt: now.toISOString(),
    today,
    isBusinessDay: businessDay,
    previousBusinessDay,
    latestSavedDate,
    latestConfirmedDate: null,
    savedToday: savedCount > 0,
    savedCount,
    judgedCount: toNumber(todayStats.judged_count),
    unknownCount: toNumber(todayStats.unknown_count),
    latestCron: monitor.latest,
    lastError: monitor.error,
    classification: monitor.classification,
    delaySeconds: monitor.delaySeconds,
    scheduledFor: monitor.received?.details?.scheduledFor ?? `${today}T15:35:00+09:00`,
    receivedAt: monitor.received?.details?.receivedAt ?? monitor.received?.createdAt ?? null,
    stage: monitor.stage,
    health: alerts.length > 0 ? "error" : monitor.classification === "RUNNING" ? "running" : "ok",
    alerts,
  };
}
