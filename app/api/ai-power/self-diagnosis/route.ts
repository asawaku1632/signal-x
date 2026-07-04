import { NextResponse } from "next/server";
import pool from "@/app/lib/postgres";

type DiagnosisItem = {
  level: "GOOD" | "WARNING" | "DANGER";
  title: string;
  message: string;
};

function addDiagnosis(
  list: DiagnosisItem[],
  level: DiagnosisItem["level"],
  title: string,
  message: string
) {
  list.push({
    level,
    title,
    message,
  });
}

export async function GET() {
  try {
    const diagnosis: DiagnosisItem[] = [];

    const reportRes = await pool.query(`
      SELECT
        report_date,
        health_score,
        scan_count,
        acquisition_rate,
        generated_recommendations,
        applied_recommendations,
        evolution_count,
        line_sent,
        qa_status,
        qa_error_count
      FROM ai_daily_reports
      ORDER BY report_date DESC, created_at DESC
      LIMIT 1
    `);

    const latestReport = reportRes.rows[0];

    if (latestReport) {
      const scanCount = Number(latestReport.scan_count ?? 0);
      const acquisitionRate = Number(latestReport.acquisition_rate ?? 0);
      const healthScore = Number(latestReport.health_score ?? 0);
      const qaStatus = String(latestReport.qa_status ?? "UNKNOWN");
      const qaErrorCount = Number(latestReport.qa_error_count ?? 0);

      if (healthScore >= 90) {
        addDiagnosis(
          diagnosis,
          "GOOD",
          "AI健康度",
          `AI健康度は${healthScore}点です。全体として非常に安定しています。`
        );
      } else if (healthScore >= 70) {
        addDiagnosis(
          diagnosis,
          "WARNING",
          "AI健康度",
          `AI健康度は${healthScore}点です。一部の監査項目を確認してください。`
        );
      } else {
        addDiagnosis(
          diagnosis,
          "DANGER",
          "AI健康度",
          `AI健康度は${healthScore}点です。運用前に確認が必要です。`
        );
      }

      if (scanCount >= 900 && acquisitionRate >= 98) {
        addDiagnosis(
          diagnosis,
          "GOOD",
          "データ取得",
          `${scanCount}銘柄を取得し、取得率は${acquisitionRate}%です。データ取得は正常です。`
        );
      } else {
        addDiagnosis(
          diagnosis,
          "WARNING",
          "データ取得",
          `取得銘柄数は${scanCount}件、取得率は${acquisitionRate}%です。未取得銘柄の確認を推奨します。`
        );
      }

      if (qaStatus === "PASS" && qaErrorCount === 0) {
        addDiagnosis(
          diagnosis,
          "GOOD",
          "QA監査",
          "QA監査はPASSで、エラー件数も0です。公開前品質として良好です。"
        );
      } else {
        addDiagnosis(
          diagnosis,
          "DANGER",
          "QA監査",
          `QA監査は${qaStatus}、エラー件数は${qaErrorCount}件です。詳細確認が必要です。`
        );
      }
    } else {
      addDiagnosis(
        diagnosis,
        "WARNING",
        "日次レポート",
        "AI日次レポートがまだ保存されていません。daily-reportを実行してください。"
      );
    }

    const recommendationRes = await pool.query(`
      SELECT
        pattern_key,
        recommended_bonus,
        win_rate,
        sample_count,
        evaluation
      FROM ai_power_recommendations
      WHERE pattern_key LIKE 'RSI:%'
         OR pattern_key LIKE 'MACD:%'
         OR pattern_key LIKE 'TREND:%'
      ORDER BY created_at DESC
      LIMIT 12
    `);

    for (const row of recommendationRes.rows) {
      const patternKey = String(row.pattern_key);
      const winRate = Number(row.win_rate ?? 0);
      const sampleCount = Number(row.sample_count ?? 0);
      const evaluation = String(row.evaluation ?? "");

      if (sampleCount < 10 || evaluation === "NOT_ENOUGH_DATA") {
        addDiagnosis(
          diagnosis,
          "WARNING",
          patternKey,
          `${patternKey} はサンプル数${sampleCount}件です。まだ判断材料が不足しています。`
        );
      } else if (evaluation === "STRONG_BUY" && winRate >= 80) {
        addDiagnosis(
          diagnosis,
          "GOOD",
          patternKey,
          `${patternKey} は${sampleCount}件の学習データがあり、勝率${winRate}%です。強い判断材料として利用できます。`
        );
      } else if (evaluation === "AVOID") {
        addDiagnosis(
          diagnosis,
          "DANGER",
          patternKey,
          `${patternKey} は勝率${winRate}%です。AIは避けるべきパターンとして認識しています。`
        );
      } else {
        addDiagnosis(
          diagnosis,
          "GOOD",
          patternKey,
          `${patternKey} は勝率${winRate}%、サンプル数${sampleCount}件です。現状維持が妥当です。`
        );
      }
    }

    const evolutionRes = await pool.query(`
      SELECT COUNT(*)::int AS count
      FROM ai_power_evolution_logs
      WHERE applied_at >= NOW() - INTERVAL '7 days'
    `);

    const evolutionCount7d = Number(evolutionRes.rows[0]?.count ?? 0);

    if (evolutionCount7d > 0) {
      addDiagnosis(
        diagnosis,
        "GOOD",
        "自己進化",
        `直近7日間で${evolutionCount7d}件のAI進化履歴があります。自己改善サイクルは稼働しています。`
      );
    } else {
      addDiagnosis(
        diagnosis,
        "WARNING",
        "自己進化",
        "直近7日間のAI進化履歴がありません。Auto Evolveの実行状況を確認してください。"
      );
    }

    const dangerCount = diagnosis.filter((item) => item.level === "DANGER")
      .length;
    const warningCount = diagnosis.filter((item) => item.level === "WARNING")
      .length;
    const goodCount = diagnosis.filter((item) => item.level === "GOOD").length;

    const overallStatus =
      dangerCount > 0 ? "DANGER" : warningCount > 0 ? "WARNING" : "GOOD";

    return NextResponse.json({
      success: true,
      aiPowerVersion: "V12.4_SELF_DIAGNOSIS",
      overallStatus,
      goodCount,
      warningCount,
      dangerCount,
      diagnosis,
    });
  } catch (error) {
    console.error("self diagnosis error:", error);

    return NextResponse.json(
      {
        success: false,
        aiPowerVersion: "V12.4_SELF_DIAGNOSIS",
        error:
          error instanceof Error
            ? error.message
            : String(error),
      },
      { status: 500 }
    );
  }
}