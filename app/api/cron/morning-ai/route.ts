import { NextResponse } from "next/server";

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
    const baseUrl =
      process.env.NEXTAUTH_URL || "http://localhost:3000";

    // ① 本番1000銘柄スキャン
    const scanData = await fetchJson(
      `${baseUrl}/api/scan?limit=1000`
    );

    // ② セクター日次保存
    const sectorSaveDailyData = await fetchJson(
      `${baseUrl}/api/sector-learning/save-daily`
    );

    // ③ AI自己進化
    const autoEvolveData = await fetchJson(
      `${baseUrl}/api/ai-power/auto-evolve`
    );

    // ④ セクター勝敗判定
    const sectorJudgeData = await fetchJson(
      `${baseUrl}/api/sector-learning/judge`
    );

    // ⑤ セクターBONUS反映
    const sectorApplyBonusData = await fetchJson(
      `${baseUrl}/api/sector-learning/apply-bonus`
    );

    // ⑥ LINEランキング通知
    const lineData = await fetchJson(
      `${baseUrl}/api/cron/line-ranking`
    );

    // ⑦ QA監査
    const qaData = await fetchJson(
      `${baseUrl}/api/verification/run`
    );

    return NextResponse.json({
      success: true,
      cronName: "V13.5_MORNING_AI_SECTOR_AUTO",
      aiPowerVersion: "V13.5",
      message:
        "Morning AI cron completed with sector learning cycle",

      steps: {
        scan: true,
        sectorSaveDaily: true,
        autoEvolve: true,
        sectorJudge: true,
        sectorApplyBonus: true,
        lineRanking: true,
        qa: true,
      },

      scan: {
        success: scanData.success,
        aiPowerVersion: scanData.aiPowerVersion,
        debugVersion: scanData.debugVersion,
        count: scanData.count,
        requestedLimit: scanData.requestedLimit,
        totalStockList: scanData.totalStockList,
        scanMs: scanData.scanMs,
        sectorWeightRuleEnabled:
          scanData.sectorWeightRuleEnabled,
      },

      sectorSaveDaily: sectorSaveDailyData,

      autoEvolve: autoEvolveData,

      sectorJudge: sectorJudgeData,

      sectorApplyBonus: sectorApplyBonusData,

      lineRanking: {
        success: lineData.success,
        status: lineData.status,
        rankingCount: lineData.rankingCount,
        top: lineData.top,
      },

      qa: qaData,

      apiTimeMs: Date.now() - startedAt,
    });
  } catch (error) {
    console.error("Morning AI cron error:", error);

    return NextResponse.json(
      {
        success: false,
        cronName: "V13.5_MORNING_AI_SECTOR_AUTO",
        aiPowerVersion: "V13.5",
        error:
          error instanceof Error
            ? error.message
            : String(error),
        apiTimeMs: Date.now() - startedAt,
      },
      {
        status: 500,
      }
    );
  }
}