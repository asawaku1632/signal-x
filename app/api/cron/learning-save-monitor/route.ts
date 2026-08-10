import { NextResponse } from "next/server";

import { saveCronRunLog } from "@/app/lib/cronRunLog";
import { sendLine } from "@/app/lib/line/sendLine";
import { getLearningSaveStatus } from "@/app/lib/learning/learningSaveStatus";
import pool from "@/app/lib/postgres";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 30;

const ROUTE = "/api/cron/learning-save-monitor";

function isAuthorized(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const authorization = request.headers.get("authorization") ?? "";
  return Boolean(cronSecret && authorization === `Bearer ${cronSecret}`);
}

async function alreadyNotifiedToday(today: string) {
  const { rows } = await pool.query(
    `SELECT EXISTS (
       SELECT 1 FROM cron_run_logs
       WHERE status = 'LINE_SUCCESS'
         AND route IN ('/api/learning/save-daily', $1)
         AND (created_at AT TIME ZONE 'Asia/Tokyo')::date = $2::date
     ) AS notified`,
    [ROUTE, today],
  );
  return rows[0]?.notified === true;
}

function alertTitle(classification: string) {
  const titles: Record<string, string> = {
    CRON_NOT_STARTED: "⚠ AI学習Cron未起動",
    SCHEDULER_DELAY: "⚠ AI学習Cron遅延",
    SCAN_FAILED: "⚠ AI学習Scan失敗",
    DB_SAVE_FAILED: "⚠ AI学習DB保存失敗",
    POST_SAVE_FAILED: "⚠ AI学習関連保存失敗",
    CRON_STALLED: "⚠ AI学習Cron停止",
  };
  return titles[classification] ?? "⚠ AI学習保存失敗";
}

function jstTime(isoString: string | null) {
  if (!isoString) return "なし";
  return `${new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(isoString))} JST`;
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const status = await getLearningSaveStatus();
    if (!status.isBusinessDay || status.health === "ok" || status.health === "running") {
      await saveCronRunLog({
        route: ROUTE,
        status: status.health === "running" ? "SKIPPED" : "COMPLETED",
        message:
          status.health === "running"
            ? "AI learning daily save is still running; notification suppressed"
            : status.isBusinessDay
              ? "AI learning daily save is healthy"
              : "AI learning save monitor skipped a non-business day",
        details: {
          today: status.today,
          health: status.health,
          classification: status.classification,
          stage: status.stage,
        },
      });
      return NextResponse.json({ success: true, notified: false, status });
    }

    if (await alreadyNotifiedToday(status.today)) {
      await saveCronRunLog({
        route: ROUTE,
        status: "SKIPPED",
        message: "AI learning save alert was already sent today",
        details: {
          today: status.today,
          classification: status.classification,
          alerts: status.alerts,
        },
      });
      return NextResponse.json({ success: true, notified: false, duplicate: true, status });
    }

    const message = [
      alertTitle(status.classification),
      `対象日: ${status.today}`,
      "予定: 15:35 JST",
      `確認: ${jstTime(status.checkedAt)}`,
      `開始: ${jstTime(typeof status.receivedAt === "string" ? status.receivedAt : null)}`,
      `遅延: ${Math.floor(status.delaySeconds / 60)}分`,
      ...status.alerts.map((alert) => `・${alert}`),
      `最新保存日: ${status.latestSavedDate ?? "なし"}`,
      `本日保存件数: ${status.savedCount}件`,
    ].join("\n");
    const line = await sendLine(message);

    await saveCronRunLog({
      route: ROUTE,
      status: line.ok ? "LINE_SUCCESS" : "LINE_FAILED",
      message: line.ok ? "AI learning save alert sent" : "AI learning save alert failed",
      httpStatus: line.status,
      details: {
        today: status.today,
        classification: status.classification,
        delaySeconds: status.delaySeconds,
        stage: status.stage,
        alerts: status.alerts,
        lineError: line.ok ? null : line.text.slice(0, 500),
      },
    });

    return NextResponse.json(
      { success: line.ok, notified: line.ok, status, lineStatus: line.status },
      { status: line.ok ? 200 : 502 },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await saveCronRunLog({
      route: ROUTE,
      status: "ERROR",
      message: "AI learning save monitor failed",
      details: { error: message },
    });
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
