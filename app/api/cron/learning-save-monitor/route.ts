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
    `
      SELECT EXISTS (
        SELECT 1
        FROM cron_run_logs
        WHERE status = 'LINE_SUCCESS'
          AND route IN ('/api/learning/save-daily', $1)
          AND (created_at AT TIME ZONE 'Asia/Tokyo')::date = $2::date
      ) AS notified
    `,
    [ROUTE, today],
  );

  return rows[0]?.notified === true;
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 },
    );
  }

  try {
    const status = await getLearningSaveStatus();

    if (!status.isBusinessDay || status.health === "ok") {
      await saveCronRunLog({
        route: ROUTE,
        status: "COMPLETED",
        message: status.isBusinessDay
          ? "AI学習保存状況は正常です"
          : "非営業日のため監視のみ実施しました",
        details: { today: status.today, health: status.health },
      });

      return NextResponse.json({
        success: true,
        notified: false,
        status,
      });
    }

    if (await alreadyNotifiedToday(status.today)) {
      await saveCronRunLog({
        route: ROUTE,
        status: "SKIPPED",
        message: "本日の保存失敗はすでにLINE通知済みです",
        details: { today: status.today, alerts: status.alerts },
      });

      return NextResponse.json({
        success: true,
        notified: false,
        duplicate: true,
        status,
      });
    }

    const message = [
      "⚠ AI学習保存失敗",
      `対象日: ${status.today}`,
      ...status.alerts.map((alert) => `・${alert}`),
      `最新保存日: ${status.latestSavedDate ?? "なし"}`,
      `本日保存件数: ${status.savedCount}件`,
    ].join("\n");
    const line = await sendLine(message);

    await saveCronRunLog({
      route: ROUTE,
      status: line.ok ? "LINE_SUCCESS" : "LINE_FAILED",
      message: line.ok
        ? "AI学習保存異常をLINE通知しました"
        : "AI学習保存異常のLINE通知に失敗しました",
      httpStatus: line.status,
      details: {
        today: status.today,
        alerts: status.alerts,
        lineError: line.ok ? null : line.text.slice(0, 500),
      },
    });

    return NextResponse.json(
      {
        success: line.ok,
        notified: line.ok,
        status,
        lineStatus: line.status,
      },
      { status: line.ok ? 200 : 502 },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await saveCronRunLog({
      route: ROUTE,
      status: "ERROR",
      message: "AI学習保存監視に失敗しました",
      details: { error: message },
    });

    return NextResponse.json(
      { success: false, error: message },
      { status: 500 },
    );
  }
}
