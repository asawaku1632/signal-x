import { NextResponse } from "next/server";
import { getAdminSession } from "@/app/lib/admin";
import { readFileSync } from "node:fs";
import { join } from "node:path";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type ResearchRun = {
  run_id: string; checked_at: string; index_key: string; provider_id: string;
  status: string; observed_at: string | null; age_minutes: string | null;
  reason: string | null;
};

type SafeDbFailure = "CONFIG_INVALID" | "AUTH_FAILED" | "TLS_FAILED" | "CONNECTION_TIMEOUT" | "NETWORK_FAILED" | "QUERY_FAILED" | "UNKNOWN";

function classifyDbFailure(error: unknown): SafeDbFailure {
  const e = error as { code?: unknown; message?: unknown } | null;
  const code = typeof e?.code === "string" ? e.code : "";
  const message = typeof e?.message === "string" ? e.message.toLowerCase() : "";
  if (message === "invalid dev db protocol" || message === "research dev db host mismatch" || error instanceof TypeError) return "CONFIG_INVALID";
  if (code === "28P01" || code === "28000") return "AUTH_FAILED";
  if (code.startsWith("ERR_TLS_") || code.startsWith("CERT_") || code === "DEPTH_ZERO_SELF_SIGNED_CERT" || code === "UNABLE_TO_VERIFY_LEAF_SIGNATURE" || message.includes("certificate") || message.includes("ssl")) return "TLS_FAILED";
  if (code === "ETIMEDOUT" || code === "ETIMEOUT" || message.includes("timeout")) return "CONNECTION_TIMEOUT";
  if (["ECONNREFUSED", "ENOTFOUND", "EAI_AGAIN", "ECONNRESET", "EHOSTUNREACH", "ENETUNREACH"].includes(code)) return "NETWORK_FAILED";
  if (/^[0-9A-Z]{5}$/.test(code)) return "QUERY_FAILED";
  return "UNKNOWN";
}

async function readDevelopmentHistory(): Promise<ResearchRun[] | null> {
  // Explicit separate development connection: never fall back to production DATABASE_URL.
  if (process.env.MARKET_INDEX_RESEARCH_DEV_READ_ENABLED !== "true") return null;
  const connectionString = process.env.MARKET_INDEX_RESEARCH_DEV_DATABASE_URL;
  if (!connectionString) return null;
  const url = new URL(connectionString);
  if (url.protocol !== "postgresql:" && url.protocol !== "postgres:") throw new Error("Invalid dev DB protocol");
  // Guard against accidentally reading a production database or arbitrary server.
  const expectedProject = "jdtqwryiyxeuoraecorw";
  const directHost = `db.${expectedProject}.supabase.co`;
  const sessionPoolerHost = "aws-0-ap-northeast-1.pooler.supabase.com";
  const isDirect = url.hostname === directHost && url.username === "postgres" && url.port === "5432";
  const isSessionPooler = url.hostname === sessionPoolerHost &&
    decodeURIComponent(url.username) === `postgres.${expectedProject}` && url.port === "5432";
  if ((!isDirect && !isSessionPooler) || !url.password || url.pathname !== "/postgres") {
    throw new Error("Research dev DB host mismatch");
  }
  const { Pool } = await import("pg");
  const pool = new Pool({ connectionString, max: 1, connectionTimeoutMillis: 4000, ssl: {
    rejectUnauthorized: true,
    ca: readFileSync(join(process.cwd(), "app/api/admin/bollinger-breakout-shadow/dev-connection-check/supabase-root-2021-ca.crt"), "utf8"),
  } });
  try {
    const client = await pool.connect();
    try {
      await client.query("BEGIN READ ONLY");
      const result = await client.query<ResearchRun>(
        `SELECT run_id, checked_at, index_key, provider_id, status, observed_at, age_minutes, reason
         FROM public.market_index_research_runs ORDER BY checked_at DESC LIMIT 30`
      );
      await client.query("ROLLBACK");
      return result.rows;
    } catch (error) {
      await client.query("ROLLBACK").catch(() => {});
      throw error;
    } finally {
      client.release();
    }
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
      providerApprovalRequired: true,
      availableBenchmarkOptions: [
        { id: "nikkei225", label: "日経平均", permission: "指数の機械処理・表示利用について日経側の許諾確認が必要", minuteBarsAvailable: false },
        { id: "topix", label: "TOPIX", permission: "J-Quants個人向け利用条件では第三者への反復配信を禁止。商用利用は別途確認", minuteBarsAvailable: false },
      ],
      scheduledCaptureConfigured: false,
      scheduledStatusPlan: {
        mode: "PREVIEW_ONLY_DISABLED",
        timezone: "Asia/Tokyo",
        proposedDailyTimeJst: "17:30",
        indices: ["nikkei", "topix"],
        recordStatus: "unavailable",
        recordReason: "PROVIDER_APPROVAL_REQUIRED",
        capturesIndexValues: false,
        writesToProduction: false,
        requiresExplicitActivation: true,
        safeguards: ["preview-environment-only", "dev-db-identity-check", "per-index-per-jst-day-deduplication", "fail-closed"],
      },
      marketOpenMinuteValidationReady: false,
      databasePersistenceConfigured: rows !== null,
      lastObservation: latest ? {
        observedAt: latest.observed_at,
        capturedAt: latest.checked_at,
        ageMinutes: latest.age_minutes === null ? null : Number(latest.age_minutes),
        status: latest.status,
      } : null,
      history: (rows ?? []).map(r => ({
        date: new Date(r.checked_at).toISOString().slice(0, 10), checkedAt: new Date(r.checked_at).toISOString(), indexKey: r.index_key, providerId: r.provider_id, reason: r.reason, observedAt: r.observed_at,
        status: r.status, ageMinutes: r.age_minutes === null ? null : Number(r.age_minutes),
      })),
      note: rows === null
        ? "研究用DBは未接続です。ChatGPTタスクの実行履歴はSIGNALXへ同期されません。"
        : "開発用DBの読み取り結果です。自動収集は未設定で、Yahoo非公式データの継続取得は行いません。",
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const failureCategory = classifyDbFailure(error);
    console.error("market index research dev read failed", failureCategory);
    return NextResponse.json({ success: false, error: "研究用DBの取得に失敗しました（本番DBへの切替は行いません）", failureCategory }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}

export async function POST(request: Request) {
  // Reject cross-origin state-changing requests in the research Preview.
  if (request.headers.get("origin") !== new URL(request.url).origin)
    return NextResponse.json({ success: false, reason: "ORIGIN_MISMATCH" }, { status: 403 });
  const { isAdmin } = await getAdminSession();
  if (!isAdmin || process.env.VERCEL_ENV !== "preview")
    return NextResponse.json({ success: false, reason: "PREVIEW_ADMIN_ONLY" }, { status: 403 });
  if (process.env.MARKET_INDEX_RESEARCH_DEV_READ_ENABLED !== "true")
    return NextResponse.json({ success: false, reason: "DEV_DB_DISABLED" }, { status: 403 });
  const payload = await request.json().catch(() => null);
  if (!payload || !["save-unavailable-status", "rollback-test"].includes(payload.action))
    return NextResponse.json({ success: false, reason: "INVALID_ACTION" }, { status: 400 });
  if (payload.indexKey !== "nikkei" && payload.indexKey !== "topix")
    return NextResponse.json({ success: false, reason: "INVALID_INDEX_KEY" }, { status: 400 });
  const saveStatus = payload.action === "save-unavailable-status";
  const indexKey: "nikkei" | "topix" = payload.indexKey;
  // Preview-only synthetic status record; no price or licensed provider data.
  let pool: import("pg").Pool | undefined;
  try {
    const connectionString = process.env.MARKET_INDEX_RESEARCH_DEV_DATABASE_URL;
    if (!connectionString) return NextResponse.json({ success: false, reason: "DEV_DB_URL_MISSING" }, { status: 503 });
    const url = new URL(connectionString);
    const ref = "jdtqwryiyxeuoraecorw";
    const valid = ["postgres:", "postgresql:"].includes(url.protocol) &&
      url.hostname === "aws-0-ap-northeast-1.pooler.supabase.com" &&
      decodeURIComponent(url.username) === "postgres." + ref &&
      url.port === "5432" && url.pathname === "/postgres" && Boolean(url.password);
    if (!valid) return NextResponse.json({ success: false, reason: "DEV_DB_IDENTITY_MISMATCH" }, { status: 403 });
    const { Pool } = await import("pg");
    pool = new Pool({ connectionString, max: 1, connectionTimeoutMillis: 4000,
      ssl: { rejectUnauthorized: true, ca: readFileSync(join(process.cwd(),
        "app/api/admin/bollinger-breakout-shadow/dev-connection-check/supabase-root-2021-ca.crt"), "utf8") } });
    const client = await pool.connect();
    let inserted = false;
    let rolledBack = false;
    let alreadySaved = false;
    const runId = (saveStatus ? "manual-unavailable-" : "preview-rollback-") + crypto.randomUUID();
    try {
      await client.query("BEGIN");
      await client.query("SET LOCAL statement_timeout = 5000");
      await client.query("SET LOCAL lock_timeout = 3000");
      if (saveStatus) {
        await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", ["manual-unavailable-" + indexKey]);
        const existing = await client.query(
          "SELECT 1 FROM public.market_index_research_runs WHERE index_key = $1 AND reason = 'PROVIDER_APPROVAL_REQUIRED' AND checked_at >= date_trunc('day', now() AT TIME ZONE 'Asia/Tokyo') AT TIME ZONE 'Asia/Tokyo' AND checked_at < (date_trunc('day', now() AT TIME ZONE 'Asia/Tokyo') + interval '1 day') AT TIME ZONE 'Asia/Tokyo' LIMIT 1",
          [indexKey]);
        alreadySaved = (existing.rowCount ?? 0) > 0;
      }
      if (!alreadySaved) await client.query(`INSERT INTO public.market_index_research_runs
        (run_id, checked_at, index_key, provider_id, provider_rights_verified, status, reason)
        VALUES ($1, now(), $4, $2, false, 'unavailable', $3)`, [runId,
        saveStatus ? 'licensed-provider-pending' : 'test-fixture',
        saveStatus ? 'PROVIDER_APPROVAL_REQUIRED' : 'ROLLBACK_ONLY', indexKey]);
      const check = await client.query<{ present: boolean }>(
        "SELECT EXISTS(SELECT 1 FROM public.market_index_research_runs WHERE run_id = $1) AS present", [runId]);
      inserted = alreadySaved || check.rows[0]?.present === true;
    } finally {
      await client.query(saveStatus && inserted ? "COMMIT" : "ROLLBACK");
      const check = await client.query<{ present: boolean }>(
        "SELECT EXISTS(SELECT 1 FROM public.market_index_research_runs WHERE run_id = $1) AS present", [runId]);
      rolledBack = alreadySaved || check.rows[0]?.present === (saveStatus && inserted);
      client.release();
    }
    const success = inserted && rolledBack;
    return NextResponse.json({ success, mode: saveStatus ? "PREVIEW_UNAVAILABLE_STATUS_SAVED" : "PREVIEW_WRITE_ROLLBACK_TEST",
      writeVerified: inserted, rollbackVerified: !saveStatus && rolledBack, persistedRows: saveStatus && success && !alreadySaved ? 1 : 0, alreadySaved, indexKey,
      marketDataCaptured: false, scheduledCaptureConfigured: false }, { status: success ? 200 : 503, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ success: false, failureCategory: classifyDbFailure(error) },
      { status: 503, headers: { "Cache-Control": "no-store" } });
  } finally {
    await pool?.end().catch(() => {});
  }
}
