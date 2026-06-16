import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type Stock = {
  code: string;
  name: string;
  score?: number;
  aiPower?: number;
  price?: number;
  changePercent?: number;
  takeProfit?: number;
  stopLoss?: number;
  reason?: string;
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
  return "https://signal-x-hazel.vercel.app";
}

function getScore(stock: Stock) {
  return stock.score ?? stock.aiPower ?? 0;
}

function formatPrice(price?: number) {
  if (!price || !Number.isFinite(price)) return "-";
  return `${Math.round(price).toLocaleString()}円`;
}

function getSignalLabel(score: number) {
  if (score >= 85) return "🔥 激熱";
  if (score >= 70) return "🟢 強い";
  if (score >= 50) return "🟡 静観";
  return "🔴 見送り";
}

function getColor(score: number) {
  if (score >= 85) return "text-purple-300";
  if (score >= 70) return "text-green-300";
  if (score >= 50) return "text-yellow-300";
  return "text-red-300";
}

export async function GET() {
  try {
    const baseUrl = getBaseUrl();

    const res = await fetch(`${baseUrl}/api/scan?limit=500`, {
      cache: "no-store",
    });

    if (!res.ok) {
      return NextResponse.json(
        {
          success: false,
          alerts: [],
          error: "scan api failed",
          status: res.status,
          baseUrl,
        },
        { status: 500 }
      );
    }

    const json = await res.json();
    const stocks: Stock[] = json.stocks || [];

    const alerts = [];

    for (const stock of stocks) {
      const score = getScore(stock);

      if (score >= 70) {
        alerts.push({
          type: getSignalLabel(score),
          title: `${stock.code} ${stock.name}`,
         message: [
  `現在値 ${formatPrice(stock.price)}`,
  `必要資金 ${Math.round((stock.price ?? 0) * 100).toLocaleString()}円`,
  `信頼度 ${score}%`,
  `🎯 利確 ${formatPrice(stock.takeProfit)}`,
  `🛡 損切 ${formatPrice(stock.stopLoss)}`,
  stock.reason ? `理由 ${stock.reason}` : "",
]
            .filter(Boolean)
            .join("\n"),
          color: getColor(score),
        });
      }

      if (stock.patterns?.rapidRise) {
        alerts.push({
          type: "🚀 急騰",
          title: `${stock.code} ${stock.name}`,
          message: "短期的な急上昇を検知。飛び乗り注意。",
          color: "text-green-300",
        });
      }

      if (stock.patterns?.rapidDrop) {
        alerts.push({
          type: "⚠️ 急落",
          title: `${stock.code} ${stock.name}`,
          message: "急落を検知。無理なエントリー注意。",
          color: "text-red-300",
        });
      }

      if (stock.patterns?.volumeBreakout) {
        alerts.push({
          type: "📈 出来高急増",
          title: `${stock.code} ${stock.name}`,
          message: "出来高の急増を検知。注目度上昇中。",
          color: "text-purple-300",
        });
      }

      if (stock.patterns?.highBreak) {
        alerts.push({
          type: "💎 高値更新",
          title: `${stock.code} ${stock.name}`,
          message: "高値更新シグナルを検知。",
          color: "text-cyan-300",
        });
      }

      if (stock.patterns?.goldenCross) {
        alerts.push({
          type: "🟢 ゴールデンクロス",
          title: `${stock.code} ${stock.name}`,
          message: "上昇トレンド形成の可能性。",
          color: "text-green-300",
        });
      }

      if (stock.patterns?.deadCross) {
        alerts.push({
          type: "🔴 デッドクロス",
          title: `${stock.code} ${stock.name}`,
          message: "下落トレンド警戒。",
          color: "text-red-400",
        });
      }

      if (stock.patterns?.lowerWickBounce) {
        alerts.push({
          type: "↗️ 下ヒゲ反発",
          title: `${stock.code} ${stock.name}`,
          message: "下落後の反発候補。",
          color: "text-cyan-300",
        });
      }

      if (stock.patterns?.upperWickWarning) {
        alerts.push({
          type: "⚠️ 上ヒゲ警戒",
          title: `${stock.code} ${stock.name}`,
          message: "利確売り圧力に注意。",
          color: "text-yellow-300",
        });
      }

      if (stock.patterns?.trendFollow) {
        alerts.push({
          type: "📊 トレンド継続",
          title: `${stock.code} ${stock.name}`,
          message: "AIがトレンド継続を検知。",
          color: "text-blue-300",
        });
      }
    }

    return NextResponse.json({
      success: true,
      alerts,
      count: alerts.length,
      stockCount: stocks.length,
      updatedAt: new Date().toISOString(),
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        alerts: [],
        error: "alerts api failed",
        message: error?.message || String(error),
        cause: error?.cause?.message || null,
      },
      { status: 500 }
    );
  }
}