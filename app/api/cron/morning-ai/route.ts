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

    // ③ 時間帯学習保存
    const timeSaveData = await fetchJson(
      `${baseUrl}/api/time-learning/save`
    );

    // ④ ボラティリティ学習保存
    const volatilitySaveData = await fetchJson(
      `${baseUrl}/api/volatility-learning/save`
    );

    // ⑤ イベント学習保存
    const eventSaveData = await fetchJson(
      `${baseUrl}/api/event-learning/save`
    );

    // ⑥ AI自己進化
    const autoEvolveData = await fetchJson(
      `${baseUrl}/api/ai-power/auto-evolve`
    );

    // ⑦ セクター勝敗判定
    const sectorJudgeData = await fetchJson(
      `${baseUrl}/api/sector-learning/judge`
    );

    // ⑧ ボラティリティ勝敗判定
    const volatilityJudgeData = await fetchJson(
      `${baseUrl}/api/volatility-learning/judge`
    );

    // ⑨ イベント勝敗判定
    const eventJudgeData = await fetchJson(
      `${baseUrl}/api/event-learning/judge`
    );

    // ⑩ 時間帯勝敗判定
    const timeJudgeData = await fetchJson(
      `${baseUrl}/api/time-learning/judge`
    );

    // ⑪ セクターBONUS反映
    const sectorApplyBonusData = await fetchJson(
      `${baseUrl}/api/sector-learning/apply-bonus`
    );

    // ⑫ LINEランキング通知
    const lineData = await fetchJson(
      `${baseUrl}/api/cron/line-ranking`
    );

    // ⑬ QA監査
    const qaData = await fetchJson(
      `${baseUrl}/api/verification/run`
    );

    return NextResponse.json({
      success: true,
      cronName: "V13.12_MORNING_AI_FULL_INTEGRATION",
      aiPowerVersion: "V13.12",
      message:
        "Morning AI cron completed with sector, time, volatility and event learning",

      steps: {
        scan: true,
        sectorSaveDaily: true,
        timeSave: true,
        volatilitySave: true,
        eventSave: true,
        autoEvolve: true,
        sectorJudge: true,
        volatilityJudge: true,
        eventJudge: true,
        timeJudge: true,
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

      learning: {
        sectorSaveDaily: sectorSaveDailyData,
        timeSave: timeSaveData,
        volatilitySave: volatilitySaveData,
        eventSave: eventSaveData,
      },

      autoEvolve: autoEvolveData,

      judges: {
        sectorJudge: sectorJudgeData,
        volatilityJudge: volatilityJudgeData,
        eventJudge: eventJudgeData,
        timeJudge: timeJudgeData,
      },

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
        cronName: "V13.12_MORNING_AI_FULL_INTEGRATION",
        aiPowerVersion: "V13.12",
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