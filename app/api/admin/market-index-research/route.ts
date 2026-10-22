import { NextResponse } from "next/server";
import { getAdminSession } from "@/app/lib/admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type ResearchRun = {
  run_id: string; checked_at: string; index_key: string; provider_id: string;
  status: string; observed_at: string | null; age_minutes: string | null;
  reason: string | null;
};

async function readDevelopmentHistory(): Promise<ResearchRun[] | null> {
  // Explicit separate development connection: never fall back to production DATABASE_URL.
  if (process.env.MARKET_INDEX_RESEARCH_DEV_READ_ENABLED !== "true") return null;
  const connectionString = process.env.MARKET_INDEX_RESEARCH_DEV_DATABASE_URL;
  if (!connectionString) return null;
  const url = new URL(connectionString);
  if (url.protocol !== "postgresql:" && url.protocol !== "postgres:") throw new Error("Invalid dev DB protocol");
  // Guard against accidentally reading a production database or arbitrary server.
  const expectedProject = "jdtqwryiyxeuoraecorw";
  if (!url.hostname.includes(expectedProject) || !url.hostname.endsWith(".supabase.com")) {
    throw new Error("Research dev DB host mismatch");
  }
  const { Pool } = await import("pg");
  const pool = new Pool({ connectionString, max: 1, connectionTimeoutMillis: 4000, ssl: { rejectUnauthorized: true } });
  try {
    const result = await pool.query<ResearchRun>(
      `SELECT run_id, checked_at, index_key, provider_id, status, observed_at, age_minutes, reason
       FROM public.market_index_research_runs ORDER BY checked_at DESC LIMIT 30`
    );
    return result.rows;
  } finally {
    await pool.end();
  }
}

export async function GET() {
  const { isAdmin } = await getAdminSession();
  if (!isAdmin) return NextResponse.json({ success: false, error: "管理者権限が必要です" }, { status: 403 });
  try {
    const rows = await readDevelopmentHistory();
    const latest = rows?.[0] ?? null;
    return NextResponse.json({
      success: true,
      asOf: new Date().toISOString(),
      mode: "RESEARCH_SHADOW_ONLY",
      source: "licensed-provider-pending",
      providerRightsVerified: false,
      scheduledCaptureConfigured: false,
      databasePersistenceConfigured: rows !== null,
      lastObservation: latest ? {
        observedAt: latest.observed_at,
        capturedAt: latest.checked_at,
        ageMinutes: latest.age_minutes === null ? null : Number(latest.age_minutes),
        status: latest.status,
      } : null,
      history: (rows ?? []).map(r => ({
        date: r.checked_at.slice(0, 10), observedAt: r.observed_at,
        status: r.status, ageMinutes: r.age_minutes === null ? null : Number(r.age_minutes),
      })),
      note: rows === null
        ? "研究用DBは未接続です。ChatGPTタスクの実行履歴はSIGNALXへ同期されません。"
        : "開発用DBの読み取り結果です。自動収集は未設定で、Yahoo非公式データの継続取得は行いません。",
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("market index research dev read failed", error instanceof Error ? error.name : "unknown");
    return NextResponse.json({ success: false, error: "研究用DBの取得に失敗しました（本番DBへの切替は行いません）" }, { status: 503 });
  }
}
