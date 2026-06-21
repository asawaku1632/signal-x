import { NextResponse } from "next/server";

function yen(value?: number) {
  if (value === undefined || value === null) return "-";
  return `${Math.round(value).toLocaleString()}円`;
}

export async function GET() {
  try {
    const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;

    if (!token) {
      return NextResponse.json(
        { success: false, error: "LINE token is missing" },
        { status: 500 }
      );
    }

    const baseUrl =
      process.env.NEXT_PUBLIC_BASE_URL ||
      "http://localhost:3000";

    const favoritesRes = await fetch(
      `${baseUrl}/api/favorites-alerts`,
      {
        cache: "no-store",
      }
    );

    const favoritesJson = await favoritesRes.json();
   const alerts =
  (favoritesJson.alerts || [])
    .filter((stock: any) => stock.score >= 70)
    .sort(
      (a: any, b: any) =>
        b.score - a.score
    );

    if (alerts.length === 0) {
      return NextResponse.json({
        success: true,
        skipped: true,
        reason: "お気に入り通知対象なし",
      });
    }

    const message =
      `━━━━━━━━━━━━━━\n` +
      `⭐ お気に入り監視\n` +
      `━━━━━━━━━━━━━━\n\n` +
      alerts
        .map((stock: any) => {
          return (
            `${stock.code} ${stock.name}\n` +
            `${stock.judge} 信頼度${stock.score}%\n` +
            `🏆 ${stock.rank}位 / ${stock.totalRank}銘柄中\n` +
            `現在値 ${yen(stock.price)}\n` +
            `👇 個別AI解析\n` +
            `${baseUrl}/analysis/${stock.code}`
          );
        })
        .join("\n\n━━━━━━━━━━━━━━\n\n");

    const lineRes = await fetch(
      "https://api.line.me/v2/bot/message/broadcast",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          messages: [
            {
              type: "text",
              text: message,
            },
          ],
        }),
      }
    );

    const text = await lineRes.text();

    return NextResponse.json({
      success: lineRes.ok,
      status: lineRes.status,
      count: alerts.length,
      message,
      response: text,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: "favorite line send failed",
        message: String(error),
      },
      { status: 500 }
    );
  }
}