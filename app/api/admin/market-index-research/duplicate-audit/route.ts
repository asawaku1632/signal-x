import { NextResponse } from "next/server";
import { getAdminSession } from "@/app/lib/admin";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { decideAuditNextStep } from "@/app/lib/step27-audit-decision.mjs";
import { analyzeAuditHistory } from "@/app/lib/step27-audit-history.mjs";
import { compareAuditGroups, classifyAuditInvestigation, type AuditGroup } from "@/app/lib/step27-audit-comparison.mjs";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const { isAdmin } = await getAdminSession();
  if (!isAdmin || process.env.VERCEL_ENV !== "preview") {
    return NextResponse.json({ success: false, reason: "PREVIEW_ADMIN_ONLY" }, { status: 403 });
  }
  if (process.env.MARKET_INDEX_RESEARCH_DEV_READ_ENABLED !== "true") {
    return NextResponse.json({ success: false, reason: "DEV_DB_DISABLED" }, { status: 403 });
  }
  const connectionString = process.env.MARKET_INDEX_RESEARCH_DEV_DATABASE_URL;
  if (!connectionString) return NextResponse.json({ success: false, reason: "DEV_DB_URL_MISSING" }, { status: 503 });
  let pool: import("pg").Pool | undefined;
  try {
    const url = new URL(connectionString);
    const ref = "jdtqwryiyxeuoraecorw";
    const direct = url.hostname === `db.${ref}.supabase.co` && url.username === "postgres" && url.port === "5432";
    const pooler = url.hostname === "aws-0-ap-northeast-1.pooler.supabase.com" &&
      decodeURIComponent(url.username) === `postgres.${ref}` && url.port === "5432";
    if (!["postgres:", "postgresql:"].includes(url.protocol) || (!direct && !pooler) ||
        url.pathname !== "/postgres" || !url.password) {
      return NextResponse.json({ success: false, reason: "DEV_DB_IDENTITY_MISMATCH" }, { status: 403 });
    }
    const { Pool } = await import("pg");
    pool = new Pool({ connectionString, max: 1, connectionTimeoutMillis: 4000,
      ssl: { rejectUnauthorized: true, ca: readFileSync(join(process.cwd(),
        "app/api/admin/bollinger-breakout-shadow/dev-connection-check/supabase-root-2021-ca.crt"), "utf8") } });
    const client = await pool.connect();
    const save = request.method === "POST";
    try {
      await client.query(save ? "BEGIN" : "BEGIN READ ONLY");
      await client.query("SET LOCAL statement_timeout = 5000");
      const result = await client.query<{ jst_date: string; index_key: string; saved_count: string; result: string }>(
        `SELECT (checked_at AT TIME ZONE 'Asia/Tokyo')::date::text AS jst_date,
          index_key, COUNT(*)::text AS saved_count,
          CASE WHEN COUNT(*) = 1 THEN 'OK' ELSE 'DUPLICATE' END AS result
         FROM public.market_index_research_runs
         WHERE reason = 'PROVIDER_APPROVAL_REQUIRED'
         GROUP BY 1, 2 ORDER BY 1 DESC, 2`
      );
      const groups = result.rows.map(row => ({ ...row, saved_count: Number(row.saved_count) }));
      const currentAudit = compareAuditGroups([], groups);
      const duplicateGroups = currentAudit.duplicateGroups;
      const decision = currentAudit.decision;
      if (save) {
        await client.query(
          "INSERT INTO public.market_index_research_audit_history (group_count, duplicate_group_count, decision, details) VALUES ($1,$2,$3,$4::jsonb)",
          [groups.length, duplicateGroups, decision, JSON.stringify(groups)]
        );
      }
      const history = await client.query<{ audited_at: string; group_count: number; duplicate_group_count: number; decision: string; details: unknown }>(
        "SELECT audited_at, group_count, duplicate_group_count, decision, details FROM public.market_index_research_audit_history ORDER BY audited_at DESC, audit_id DESC LIMIT 20"
      );
      const previous = history.rows[save ? 1 : 0] ?? null;
      const oldGroups: AuditGroup[] = previous && Array.isArray(previous.details) ? previous.details as AuditGroup[] : [];
      const comparisonResult = previous ? compareAuditGroups(oldGroups, groups) : null;
      const investigation = classifyAuditInvestigation(comparisonResult, groups);
      const historyAnalysis = analyzeAuditHistory(history.rows);
      const nextStep = decideAuditNextStep(investigation, historyAnalysis);
      const todayJst = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
      const todaySaved = history.rows.some(h => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(h.audited_at)) === todayJst);
      await client.query("COMMIT");
      return NextResponse.json({ success: true, mode: save ? "PREVIEW_DEV_MANUAL_AUDIT_SAVED" : "PREVIEW_DEV_READ_ONLY_AUDIT", saved: save, history: history.rows.map(({ details, ...h }) => h),
        comparison: { baselineAt: previous?.audited_at ?? null, status: comparisonResult?.status ?? "NO_BASELINE", changes: comparisonResult?.changes ?? [] },
        investigation,
        historyAnalysis,
        nextStep,
        todayAuditStatus: todaySaved ? "SAVED_TODAY" : "NOT_SAVED_TODAY",
        asOf: new Date().toISOString(), groups, groupCount: groups.length, duplicateGroups,
        decision,
        marketDataCaptured: false, scheduledCaptureConfigured: false },
        { headers: { "Cache-Control": "no-store" } });
    } catch {
      await client.query("ROLLBACK").catch(() => {});
      return NextResponse.json({ success: false, reason: "QUERY_FAILED" }, { status: 503 });
    } finally { client.release(); }
  } catch {
    return NextResponse.json({ success: false, reason: "DEV_DB_READ_FAILED" }, { status: 503 });
  } finally { await pool?.end().catch(() => {}); }
}

export async function POST(request: Request) {
  if (request.headers.get("origin") !== new URL(request.url).origin) {
    return NextResponse.json({ success: false, reason: "ORIGIN_MISMATCH" }, { status: 403 });
  }
  return GET(request);
}
