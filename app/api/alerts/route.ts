import { NextResponse } from "next/server";

export async function GET() {
  try {
    const baseUrl =
      process.env.NEXT_PUBLIC_BASE_URL ||
      "http://localhost:3000";

    const res = await fetch(
      `${baseUrl}/api/scan`,
      {
        cache: "no-store",
      }
    );

    const json = await res.json();

    const stocks = json.stocks || [];

    const alerts = [];

    for (const stock of stocks) {
      // 💥 大本命
      if (stock.score >= 85) {
        alerts.push({
          type: "💥 大本命",
          title: `${stock.name} AI POWER ${stock.score}`,
          message:
            "AIが超強気シグナルを検出。",
          color: "text-purple-300",
        });
      }

      // 🔥 本命
      if (
        stock.score >= 70 &&
        stock.score < 85
      ) {
        alerts.push({
          type: "🔥 本命",
          title: `${stock.name} 本命候補`,
          message:
            "AI監視価値高め。",
          color: "text-orange-300",
        });
      }

      // 📈 急騰
      if (stock.patterns?.rapidRise) {
        alerts.push({
          type: "📈 急騰",
          title: `${stock.name} 急騰検知`,
          message:
            "短期強上昇を検出。",
          color: "text-green-300",
        });
      }

      // 📉 急落
      if (stock.patterns?.rapidDrop) {
        alerts.push({
          type: "📉 急落警戒",
          title: `${stock.name} 急落`,
          message:
            "無理なエントリー注意。",
          color: "text-red-300",
        });
      }

      // 🟣 出来高急増
      if (stock.patterns?.volumeBreakout) {
        alerts.push({
          type: "🟣 出来高急増",
          title: `${stock.name} 出来高急増`,
          message:
            "資金流入を検出。",
          color: "text-purple-300",
        });
      }

      // 🚀 高値更新
      if (stock.patterns?.highBreak) {
        alerts.push({
          type: "🚀 高値更新",
          title: `${stock.name} ブレイク`,
          message:
            "高値更新シグナル。",
          color: "text-cyan-300",
        });
      }

      // 🟢 GC接近
      if (stock.patterns?.goldenCross) {
        alerts.push({
          type: "🟢 GC接近",
          title: `${stock.name} ゴールデンクロス`,
          message:
            "上昇トレンド形成の可能性。",
          color: "text-green-300",
        });
      }

      // 🔴 DC警戒
      if (stock.patterns?.deadCross) {
        alerts.push({
          type: "🔴 DC警戒",
          title: `${stock.name} デッドクロス`,
          message:
            "下落トレンド注意。",
          color: "text-red-400",
        });
      }

      // 🔵 下ヒゲ反発
      if (stock.patterns?.lowerWickBounce) {
        alerts.push({
          type: "🔵 下ヒゲ反発",
          title: `${stock.name} 反発候補`,
          message:
            "下落後の戻りを検出。",
          color: "text-cyan-300",
        });
      }

      // 🟠 上ヒゲ警戒
      if (stock.patterns?.upperWickWarning) {
        alerts.push({
          type: "🟠 上ヒゲ警戒",
          title: `${stock.name} 上値重め`,
          message:
            "利確売り注意。",
          color: "text-yellow-300",
        });
      }

      // 🧠 トレンド継続
      if (stock.patterns?.trendFollow) {
        alerts.push({
          type: "🧠 トレンド継続",
          title: `${stock.name} 継続上昇`,
          message:
            "AIがトレンド継続を検出。",
          color: "text-blue-300",
        });
      }
    }

    return NextResponse.json({
      success: true,
      alerts,
      count: alerts.length,
      updatedAt: new Date(),
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      {
        success: false,
        alerts: [],
      },
      {
        status: 500,
      }
    );
  }
}