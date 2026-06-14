import { NextResponse } from "next/server";

import {
  getNotificationLogs,
  updateNotificationLog,
} from "@/app/lib/notificationLog";

function yen(value?: number) {
  if (!value) return "-";
  return `${Math.round(value).toLocaleString()}円`;
}

async function sendLine(message: string) {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;

  if (!token) return false;

  const res = await fetch(
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

  return res.ok;
}

export async function GET() {
  try {
    const logs = await getNotificationLogs();

    const baseUrl = "https://signal-x-ppjg.vercel.app";

    const scanRes = await fetch(`${baseUrl}/api/scan`, {
      cache: "no-store",
    });

    const scanJson = await scanRes.json();
    const stocks = scanJson.stocks || [];

    const results = [];

    for (const log of logs) {
      const target = stocks.find(
        (s: any) => s.code === log.code
      );

      const currentPrice = target?.price ?? 0;

      let status = "価格取得待ち";
      let lineSent = false;

      if (currentPrice > 0) {
        status = "監視中";

        if (
          currentPrice >= log.takeProfit &&
          !log.profitNotified
        ) {
          status = "🎯 利確達成";

          lineSent = await sendLine(
            `🎯 利確達成\n\n` +
              `${log.code} ${log.name}\n\n` +
              `通知時 ${yen(log.price)}\n` +
              `現在値 ${yen(currentPrice)}\n` +
              `利確ライン ${yen(log.takeProfit)}\n\n` +
              `想定利益 +${yen(
                (log.takeProfit - log.price) * 100
              )}\n\n` +
              `AI予測成功🎉\n` +
              `${baseUrl}/analysis/${log.code}`
          );

          if (lineSent) {
            await updateNotificationLog(log.id, {
              profitNotified: true,
            });
          }
        }

        if (
          currentPrice <= log.stopLoss &&
          !log.stopLossNotified
        ) {
          status = "🛡 損切到達";

          lineSent = await sendLine(
            `🛡 損切到達\n\n` +
              `${log.code} ${log.name}\n\n` +
              `通知時 ${yen(log.price)}\n` +
              `現在値 ${yen(currentPrice)}\n` +
              `損切ライン ${yen(log.stopLoss)}\n\n` +
              `想定損失 -${yen(
                (log.price - log.stopLoss) * 100
              )}\n\n` +
              `次のチャンスを待ちましょう\n` +
              `${baseUrl}/analysis/${log.code}`
          );

          if (lineSent) {
            await updateNotificationLog(log.id, {
              stopLossNotified: true,
            });
          }
        }
if (
  currentPrice >= log.takeProfit &&
  !log.profitNotified
) {
  status = "🎯 利確達成";

  lineSent = await sendLine(
    `🎯 利確達成\n\n` +
      `${log.code} ${log.name}\n\n` +
      `通知時 ${yen(log.price)}\n` +
      `現在値 ${yen(currentPrice)}\n` +
      `利確ライン ${yen(log.takeProfit)}\n\n` +
      `想定利益 +${yen((log.takeProfit - log.price) * 100)}\n\n` +
      `おめでとうございます🎉\n` +
      `${baseUrl}/analysis/${log.code}`
  );

  if (lineSent) {
    await updateNotificationLog(log.id, {
      profitNotified: true,
    });
  }
}
        if (
          currentPrice >= log.takeProfit &&
          log.profitNotified
        ) {
          status = "🎯 利確通知済み";
        }

        if (
          currentPrice <= log.stopLoss &&
          log.stopLossNotified
        ) {
          status = "🛡 損切通知済み";
        }
      }

      results.push({
        code: log.code,
        name: log.name,
        currentPrice,
        takeProfit: log.takeProfit,
        stopLoss: log.stopLoss,
        profitNotified: log.profitNotified ?? false,
        stopLossNotified: log.stopLossNotified ?? false,
        status,
        lineSent,
      });
    }

    return NextResponse.json({
      count: results.length,
      results,
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      {
        error: "check-profit failed",
      },
      {
        status: 500,
      }
    );
  }
}