import { NextResponse } from "next/server";
import { Pool } from "pg";
import { getLearningOwnerSession } from "@/app/lib/learningOwner";
import { classifyProspectiveEvidence } from "@/app/lib/research/prospectiveEvidenceGate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store" };
const deny = (reason: string, status = 403) => NextResponse.json({ success: false, reason }, { status, headers });

export async function GET() {
  if (!(await getLearningOwnerSession()).isOwner) return deny("OWNER_ONLY");
  if (process.env.VERCEL_ENV !== "preview" ||
      process.env.VERCEL_GIT_COMMIT_REF !== "research/morning-quote-metadata-diagnostics-20261026" ||
      process.env.JQUANTS_RESEARCH_PROBE_ENABLED !== "true") return deny("RESEARCH_PREVIEW_ONLY");
  let url: URL;
  try { url = new URL(process.env.MARKET_INDEX_RESEARCH_DEV_DATABASE_URL ?? ""); }
  catch { return deny("DEV_DB_NOT_CONFIGURED", 503); }
  if (!(url.hostname === "db.jdtqwryiyxeuoraecorw.supabase.co" ||
        (url.hostname.endsWith(".pooler.supabase.com") && url.username.includes("jdtqwryiyxeuoraecorw"))))
    return deny("DEV_DB_NOT_VERIFIED", 503);
  const pool = new Pool({ connectionString: process.env.MARKET_INDEX_RESEARCH_DEV_DATABASE_URL, ssl: { rejectUnauthorized: false }, max: 1, connectionTimeoutMillis: 8000 });
  try {
    const [historical, snapshots] = await Promise.all([
      pool.query("SELECT count(*)::int AS count, min(created_at) AS first_saved, max(created_at) AS last_saved FROM public.bb_signal_events WHERE signal_date=$1::date", ["2026-08-10"]),
      pool.query("SELECT code, observation_date::text, provider, provider_timestamp, bar_end_at, created_at, detector_version FROM public.technical_bb_observation_snapshots ORDER BY observation_date, code LIMIT 100")
    ]);
    const evaluated = snapshots.rows.map(row => {
      const result = classifyProspectiveEvidence({
        signalObservedAt: null, // No independently preserved original decision timestamp.
        priceObservedAt: row.provider_timestamp?.toISOString() ?? null,
        capturedAt: row.created_at?.toISOString() ?? null,
        provider: row.provider,
        modelVersion: row.detector_version,
        signalDate: row.observation_date,
        barEndAt: row.bar_end_at?.toISOString() ?? null
      });
      return { code: row.code, observationDate: row.observation_date, eligible: result.eligible, reason: result.reason };
    });
    return NextResponse.json({
      success: true, mode: "READ_ONLY_METADATA_AUDIT", productionApplied: false, saved: false,
      historicalAug10: { count: historical.rows[0].count, firstSaved: historical.rows[0].first_saved, lastSaved: historical.rows[0].last_saved, prospectiveEvidence: "NOT_ESTABLISHED" },
      snapshots: { inspected: evaluated.length, eligible: evaluated.filter(x => x.eligible).length, results: evaluated },
      note: "Snapshot provider timestamp is not proof of signal generation time; missing signal timestamp fails closed."
    }, { headers });
  } catch { return deny("DEV_READ_FAILED", 503); }
  finally { await pool.end(); }
}
