import { NextResponse } from "next/server";

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
  "https://signal-x-ppjg.vercel.app";

    const scanRes = await fetch(`${baseUrl}/api/scan`, {
      cache: "no-store",
    });

    const scanJson = await scanRes.json();
    const stocks = scanJson.stocks || [];

    if (stocks.length === 0) {
      return NextResponse.json({
        success: false,
        error: "No stocks found",
      });
    }

    const top = stocks[0];

    const message =
      `🚨 SIGNALX ALERT\n\n` +
      `${top.name} (${top.code})\n\n` +
      `AI POWER: ${top.score}\n` +
      `判定: ${top.score >= 85 ? "激熱🔥" : top.score >= 70 ? "本命🔥" : "監視"}\n\n` +
      `理由:\n${top.reason || "シグナル理由なし"}\n\n` +
      `RSI: ${top.rsi}\n` +
      `出来高: ${top.volumeRatio}x\n` +
      `変化率: ${top.changePercent}%\n\n` +
      `${baseUrl}/analysis/${top.code}`;

    const res = await fetch("https://api.line.me/v2/bot/message/broadcast", {
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
    });

    const text = await res.text();

    return NextResponse.json({
      success: res.ok,
      status: res.status,
      sentStock: top,
      response: text,
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      { success: false, error: "LINE send failed" },
      { status: 500 }
    );
  }
}