import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type Stock = {
  code: string;
  name: string;
  score?: number;
  aiPower?: number;
  patterns?: {
    rapidRise?: boolean;
    rapidDrop?: boolean;
    volumeBreakout?: boolean;
    highBreak?: boolean;
    goldenCross?: boolean;
    deadCross?: boolean;
    lowerWickBounce?: boolean;
    upperWickWarning?: boolean;
    trendFollow?: boolean;
  };
};

function getBaseUrl() {
  return (
    process.env.NEXT_PUBLIC_BASE_URL ||
    process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : "https://signal-x-ppjg.vercel.app"
  );
}

function getScore(stock: Stock) {
  return stock.score ?? stock.aiPower ?? 0;
}

export async function GET() {
  try {
    const baseUrl = getBaseUrl();

    const res = await fetch(`${baseUrl}/api/scan`, {
      cache: "no-store",
    });

    if (!res.ok) {
      return NextResponse.json(
        {
          success: false,
          alerts: [],
          error: "scan api failed",
          status: res.status,
        },
        { status: 500 }
      );
    }

    const json = await res.json();
    const stocks: Stock[] = json.stocks || [];

    const alerts = [];

    for (const stock of stocks) {
      const score = getScore(stock);

      if (score >= 85) {
        alerts.push({
          type: "💥 大本命",
          title: `${stock.name} AI POWER ${score}`,
          message: "AIが超強気シグナルを検出。",
          color: "text-purple-300",
        });
      }

      if (score >= 70 && score < 85) {
        alerts.push({
          type: "🔥 本命",
          title: `${stock.name} 本命候補`,
          message: "AI監視価値高め。",
          color: "text-orange-300",
        });
      }

      if (stock.patterns?.rapidRise) {
        alerts.push({
          type: "📈 急騰",
          title: `${stock.name} 急騰検知`,
          message: "短期強上昇を検出。",
          color: "text-green-300",
        });
      }

      if (stock.patterns?.rapidDrop) {
        alerts.push({
          type: "📉 急落警戒",
          title: `${stock.name} 急落`,
          message: "無理なエントリー注意。",
          color: "text-red-300",
        });
      }

      if (stock.patterns?.volumeBreakout) {
        alerts.push({
          type: "🟣 出来高急増",
          title: `${stock.name} 出来高急増`,
          message: "資金流入を検出。",
          color: "text-purple-300",
        });
      }

      if (stock.patterns?.highBreak) {
        alerts.push({
          type: "🚀 高値更新",
          title: `${stock.name} ブレイク`,
          message: "高値更新シグナル。",
          color: "text-cyan-300",
        });
      }

      if (stock.patterns?.goldenCross) {
        alerts.push({
          type: "🟢 GC接近",
          title: `${stock.name} ゴールデンクロス`,
          message: "上昇トレンド形成の可能性。",
          color: "text-green-300",
        });
      }

      if (stock.patterns?.deadCross) {
        alerts.push({
          type: "🔴 DC警戒",
          title: `${stock.name} デッドクロス`,
          message: "下落トレンド注意。",
          color: "text-red-400",
        });
      }

      if (stock.patterns?.lowerWickBounce) {
        alerts.push({
          type: "🔵 下ヒゲ反発",
          title: `${stock.name} 反発候補`,
          message: "下落後の戻りを検出。",
          color: "text-cyan-300",
        });
      }

      if (stock.patterns?.upperWickWarning) {
        alerts.push({
          type: "🟠 上ヒゲ警戒",
          title: `${stock.name} 上値重め`,
          message: "利確売り注意。",
          color: "text-yellow-300",
        });
      }

      if (stock.patterns?.trendFollow) {
        alerts.push({
          type: "🧠 トレンド継続",
          title: `${stock.name} 継続上昇`,
          message: "AIがトレンド継続を検出。",
          color: "text-blue-300",
        });
      }
    }

    return NextResponse.json({
      success: true,
      alerts,
      count: alerts.length,
      updatedAt: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error(error);

    return NextResponse.json(
      {
        success: false,
        alerts: [],
        error: "alerts api failed",
        message: error?.message || String(error),
      },
      { status: 500 }
    );
  }
}