import { NextResponse } from "next/server";

import {
  getNotificationLogs,
  updateNotificationLog,
} from "@/app/lib/notificationLog";

import { saveNotificationResult } from "@/app/lib/notificationResult";

function yen(value?: number) {
  if (value === undefined || value === null) return "-";
  return `${Math.round(value).toLocaleString()}円`;
}

async function sendLine(message: string) {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;

  if (!token) {
    return {
      ok: false,
      status: 500,
      text: "LINE token missing",
    };
  }

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

  return {
    ok: res.ok,
    status: res.status,
    text,
  };
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const baseUrl = url.origin;
    const publicUrl = "https://signal-x-ppjg.vercel.app";

    const logs = await getNotificationLogs();

    const scanRes = await fetch(`${baseUrl}/api/scan?limit=1000`, {
      cache: "no-store",
    });

    if (!scanRes.ok) {
      return NextResponse.json(
        {
          success: false,
          error: "scan api failed",
          status: scanRes.status,
        },
        { status: 500 }
      );
    }

    const scanJson = await scanRes.json();
    const stocks = scanJson.stocks || [];

    const results = [];

    for (const log of logs) {
      const target = stocks.find((s: any) => s.code === log.code);
      const currentPrice = target?.price ?? 0;

      let status = "価格取得待ち";
      let lineSent = false;
      let lineStatus = 0;
      let lineResponse = "";

      const profitAmount =
        currentPrice > 0 ? Math.round((currentPrice - log.price) * 100) : 0;

      const lossAmount =
        currentPrice > 0 ? Math.round((log.price - currentPrice) * 100) : 0;

      if (currentPrice > 0) {
        status = "監視中";

        if (currentPrice >= log.takeProfit) {
          if (!log.profitNotified) {
            status = "🎯 利確達成";

            const line = await sendLine(
              `━━━━━━━━━━━━━━\n` +
                `🎯 利確達成\n` +
                `━━━━━━━━━━━━━━\n\n` +
                `${log.code} ${log.name}\n\n` +
                `【通知時】${yen(log.price)}\n` +
                `【現在値】${yen(currentPrice)}\n` +
                `【利確ライン】${yen(log.takeProfit)}\n\n` +
                `【利益】+${yen(profitAmount)}\n\n` +
                `AI予測成功🎉\n\n` +
                `👇 個別AI解析\n` +
                `${publicUrl}/analysis/${log.code}\n` +
                `━━━━━━━━━━━━━━`
            );

            lineSent = line.ok;
            lineStatus = line.status;
            lineResponse = line.text;

            if (line.ok) {
              await updateNotificationLog(log.id, {
                profitNotified: true,
              });

              await saveNotificationResult(log, {
                price1h: currentPrice,
              });
            }
          } else {
            status = "🎯 利確通知済み";
          }
        } else if (currentPrice <= log.stopLoss) {
          if (!log.stopLossNotified) {
            status = "🛡 損切到達";

            const line = await sendLine(
              `━━━━━━━━━━━━━━\n` +
                `🛡 損切到達\n` +
                `━━━━━━━━━━━━━━\n\n` +
                `${log.code} ${log.name}\n\n` +
                `【通知時】${yen(log.price)}\n` +
                `【現在値】${yen(currentPrice)}\n` +
                `【損切ライン】${yen(log.stopLoss)}\n\n` +
                `【損失】-${yen(lossAmount)}\n\n` +
                `次のチャンスを待ちましょう\n\n` +
                `👇 個別AI解析\n` +
                `${publicUrl}/analysis/${log.code}\n` +
                `━━━━━━━━━━━━━━`
            );

            lineSent = line.ok;
            lineStatus = line.status;
            lineResponse = line.text;

            if (line.ok) {
              await updateNotificationLog(log.id, {
                stopLossNotified: true,
              });

              await saveNotificationResult(log, {
                price1h: currentPrice,
              });
            }
          } else {
            status = "🛡 損切通知済み";
          }
        }
      }

      results.push({
        id: log.id,
        code: log.code,
        name: log.name,
        notifiedAt: log.notifiedAt,
        notifiedPrice: log.price,
        currentPrice,
        takeProfit: log.takeProfit,
        stopLoss: log.stopLoss,
        profitNotified: log.profitNotified ?? false,
        stopLossNotified: log.stopLossNotified ?? false,
        status,
        profitAmount,
        lossAmount,
        lineSent,
        lineStatus,
        lineResponse,
      });
    }

    return NextResponse.json({
      success: true,
      count: results.length,
      results,
    });
  } catch (error: any) {
    console.error(error);

    return NextResponse.json(
      {
        success: false,
        error: "check-profit failed",
        message: error?.message || String(error),
      },
      { status: 500 }
    );
  }
}