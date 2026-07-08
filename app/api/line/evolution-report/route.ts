import { NextResponse } from "next/server";
import { sendLine } from "@/app/lib/line/sendLine";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const DEBUG_VERSION = "V26_3_1_AI_EVOLUTION_LINE_REPORT_0708";

function formatDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value.slice(0, 10);
  }

  return date.toLocaleDateString("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

function formatComment(comment: string) {
  return String(comment || "")
    .replace(/。/g, "。\n\n")
    .trim();
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const baseUrl = url.origin;

    const reportRes = await fetch(`${baseUrl}/api/evolution/report`, {
      cache: "no-store",
    });

    const reportJson = await reportRes.json();

    if (!reportRes.ok || !reportJson.success || !reportJson.report) {
      return NextResponse.json(
        {
          success: false,
          debugVersion: DEBUG_VERSION,
          error: "AI成長レポートの取得に失敗しました。",
          reportStatus: reportRes.status,
          reportJson,
        },
        { status: 500 }
      );
    }

    const report = reportJson.report;
    const comment = formatComment(report.comment);

    const message = `🤖 SIGNALX AIより

━━━━━━━━━━━━━━
📅 ${formatDate(report.date)}
AI学習完了
━━━━━━━━━━━━━━

📚 学習件数：${report.processedCount}件
🏆 WIN：${report.winCount}件
📉 LOSE：${report.loseCount}件
➖ HOLD：${report.holdCount}件

🧠 AI完成度：${report.qualityScore}%
🎯 予測的中率：${report.overallWinRate}%

💬 今日のAIコメント
${comment}

📱 SIGNALX
明日も市場を監視し、さらに学習を続けます。`;

    const line = await sendLine(message);

    return NextResponse.json({
      success: line.ok,
      debugVersion: DEBUG_VERSION,
      checkedAt: new Date().toISOString(),
      status: line.status,
      response: line.text,
      message,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        debugVersion: DEBUG_VERSION,
        checkedAt: new Date().toISOString(),
        error:
          error instanceof Error
            ? error.message
            : "AI成長レポートLINE通知に失敗しました。",
      },
      { status: 500 }
    );
  }
}