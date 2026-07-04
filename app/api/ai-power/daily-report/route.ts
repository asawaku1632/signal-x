import { NextResponse } from "next/server";
import pool from "@/app/lib/postgres";

async function fetchJson(url: string) {
  const res = await fetch(url, {
    cache: "no-store",
  });

  const data = await res.json();

  if (!data.success) {
    throw new Error(`FAILED: ${url}`);
  }

  return data;
}

export async function GET() {
  const startedAt = Date.now();

  try {
    const baseUrl = "http://localhost:3000";

    const morningData = await fetchJson(`${baseUrl}/api/cron/morning-ai`);

    const scan = morningData.scan ?? {};
    const autoEvolve = morningData.autoEvolve ?? {};
    const lineRanking = morningData.lineRanking ?? {};
    const qa = morningData.qa ?? {};

    const reportDate = new Date().toISOString().slice(0, 10);

    const scanCount = scan.count ?? 0;
    const acquisitionRate = qa.acquisitionRate
      ? Math.round(qa.acquisitionRate * 10000) / 100
      : 0;

    const generatedRecommendations = autoEvolve.generated ?? 0;
    const appliedRecommendations = autoEvolve.applied ?? 0;
    const evolutionCount = autoEvolve.evolutionLogsAdded ?? 0;

    const qaStatus = qa.status ?? "UNKNOWN";
    const lineSent = Boolean(lineRanking.success);

    let healthScore = 0;

    if (scanCount >= 900) healthScore += 25;
    if (generatedRecommendations > 0) healthScore += 20;
    if (appliedRecommendations > 0) healthScore += 20;
    if (evolutionCount > 0) healthScore += 15;
    if (lineSent) healthScore += 10;
    if (qaStatus === "PASS") healthScore += 10;

    const summary =
      `本日は${scanCount}銘柄を解析。` +
      `AIは${generatedRecommendations}件の改善提案を生成し、` +
      `${appliedRecommendations}件をAI POWERへ反映しました。` +
      `進化履歴は${evolutionCount}件保存され、` +
      `QA監査は${qaStatus}です。`;

    await pool.query(
      `
      INSERT INTO ai_daily_reports (
        report_date,
        health_score,
        scan_count,
        acquisition_rate,
        generated_recommendations,
        applied_recommendations,
        evolution_count,
        line_sent,
        line_top_code,
        line_top_name,
        line_ranking_count,
        qa_status,
        qa_error_count,
        summary
      )
      VALUES (
        $1, $2, $3, $4, $5, $6, $7,
        $8, $9, $10, $11, $12, $13, $14
      )
      `,
      [
        reportDate,
        healthScore,
        scanCount,
        acquisitionRate,
        generatedRecommendations,
        appliedRecommendations,
        evolutionCount,
        lineSent,
        lineRanking.top?.code ?? null,
        lineRanking.top?.name ?? null,
        lineRanking.rankingCount ?? 0,
        qaStatus,
        qa.errorCount ?? 0,
        summary,
      ]
    );

    return NextResponse.json({
      success: true,
      aiPowerVersion: "V12.2_DAILY_REPORT_SAVED",
      reportDate,
      healthScore,
      scanCount,
      acquisitionRate,
      generatedRecommendations,
      appliedRecommendations,
      evolutionCount,
      lineSent,
      lineTopCode: lineRanking.top?.code ?? null,
      lineTopName: lineRanking.top?.name ?? null,
      lineRankingCount: lineRanking.rankingCount ?? 0,
      qaStatus,
      qaErrorCount: qa.errorCount ?? 0,
      summary,
      saved: true,
      apiTimeMs: Date.now() - startedAt,
    });
  } catch (error) {
    console.error("daily report error:", error);

    return NextResponse.json(
      {
        success: false,
        aiPowerVersion: "V12.2_DAILY_REPORT_SAVED",
        error:
          error instanceof Error
            ? error.message
            : String(error),
      },
      { status: 500 }
    );
  }
}