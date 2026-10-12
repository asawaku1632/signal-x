import { NextResponse } from "next/server";
import pool from "@/app/lib/postgres";
import { getAdminSession } from "@/app/lib/admin";
import { getJstDateString } from "@/app/lib/learning/learningSaveStatus";
import { WIN_RATE_DAILY_AUDIT_ROUTE } from "@/app/lib/learning/winRateReliabilityAudit";
import { readAuditHistory, summarizeWeeklyAudits } from "@/app/lib/learning/winRateWeeklyAudit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const { isAdmin } = await getAdminSession();
  if (!isAdmin) {
    return NextResponse.json({ success: false, error: "Administrator access required" }, { status: 403 });
  }
  try {
    // Read-only; archived rows are never reclassified based on missing snapshots.
    const [summary, batches, provenance, recentAuditLogs] = await Promise.all([
      pool.query(`
        SELECT
          COUNT(*) FILTER (WHERE result='WIN')::int AS wins,
          COUNT(*) FILTER (WHERE result='LOSE')::int AS losses,
          COUNT(*) FILTER (
            WHERE date='2026-08-12' AND checked_at=TIMESTAMP '2026-08-13 11:28:07.82195'
            AND result IN ('WIN','LOSE','HOLD')
          )::int AS legacy_count,
          COUNT(*) FILTER (
            WHERE date='2026-08-12' AND checked_at=TIMESTAMP '2026-08-13 11:28:07.82195'
            AND result='WIN'
          )::int AS legacy_wins,
          COUNT(*) FILTER (
            WHERE date='2026-08-12' AND checked_at=TIMESTAMP '2026-08-13 11:28:07.82195'
            AND result='LOSE'
          )::int AS legacy_losses
        FROM daily_stock_results
      `),
      pool.query(`
        SELECT
          CASE WHEN checked_at=TIMESTAMP '2026-08-13 11:28:07.82195'
            THEN 'untraced_legacy_batch'
            WHEN checked_at=TIMESTAMP '2026-08-13 07:13:50.346599'
            THEN 'snapshot_match_batch'
            ELSE 'other' END AS group_key,
          COUNT(*)::int AS total,
          COUNT(*) FILTER (WHERE result='WIN')::int AS win,
          COUNT(*) FILTER (WHERE result='LOSE')::int AS lose,
          COUNT(*) FILTER (WHERE result='HOLD')::int AS hold
        FROM daily_stock_results
        WHERE date='2026-08-12' AND result IN ('WIN','LOSE','HOLD')
        GROUP BY 1
        ORDER BY group_key
      `),
      pool.query(`
        SELECT COUNT(*)::int AS total_traced,
          MAX(recorded_at) AS last_recorded_at
        FROM public.daily_result_price_provenance
      `),
      pool.query(`
        SELECT status, details, created_at
        FROM cron_run_logs
        WHERE route = $1
          AND created_at >= NOW() - INTERVAL '45 days'
          AND status IN ('COMPLETED','ERROR')
        ORDER BY created_at DESC
        LIMIT 100
      `, [WIN_RATE_DAILY_AUDIT_ROUTE]),
    ]);
    const s = summary.rows[0];
    const wins = Number(s.wins);
    const losses = Number(s.losses);
    const legacyWins = Number(s.legacy_wins);
    const legacyLosses = Number(s.legacy_losses);
    const rate = (w: number, l: number) => w + l ? Math.round(10000 * w / (w + l)) / 100 : null;
    const now = new Date();
    const todayJst = getJstDateString(now);
    const timeJst = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Tokyo", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
    }).format(now);
    const days = readAuditHistory(recentAuditLogs.rows);
    const weekly = summarizeWeeklyAudits(days, todayJst, timeJst);
    return NextResponse.json({
      success: true,
      asOf: now.toISOString(),
      dailyReliability: {
        scheduleJst: "18:15",
        latest: days[0] ?? null,
        recent: days.slice(0, 15),
        weekly,
      },
      reported: { wins, losses, winRate: rate(wins, losses) },
      historicalUntraced: {
        tradeDate: "2026-08-12",
        count: Number(s.legacy_count),
        wins: legacyWins,
        losses: legacyLosses,
        status: "PRICE_ORIGIN_NOT_RECORDED",
      },
      sensitivity: {
        excludingHistoricalUntraced: rate(wins - legacyWins, losses - legacyLosses),
        note: "仮に対象群を除外した場合の差分。誤判定を意味しません。",
      },
      batches: batches.rows,
      newProvenance: {
        count: Number(provenance.rows[0]?.total_traced ?? 0),
        latestAt: provenance.rows[0]?.last_recorded_at ?? null,
        scope: "NEW_CHECKS_ONLY",
      },
    }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error("[ai-win-rate-audit] read failed", error);
    return NextResponse.json({ success: false, error: "監査データの取得に失敗しました" }, { status: 500 });
  }
}
