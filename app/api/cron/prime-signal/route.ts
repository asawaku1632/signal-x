import { NextResponse } from "next/server";
import { requireCronAuth } from "@/app/lib/cronAuth";
import {
  PRIME_SIGNAL_SCORE,
  claimPrimeSignal,
  markPrimeSignalNotified,
  rearmPrimeSignals,
  releasePrimeSignalClaim,
} from "@/app/lib/primeSignalState";
import { pushWebToAll } from "@/app/lib/push/userPush";
import { getTseCashSessionStatus } from "@/app/lib/technicalObservation/tseMarketCalendar";

type Stock = {
  code: string;
  name?: string;
  price?: number;
  score?: number;
  aiPower?: number;
  takeProfit?: number;
  stopLoss?: number;
};

export async function GET(req: Request) {
  const unauthorized = requireCronAuth(req);
  if (unauthorized) return unauthorized;

  const session = getTseCashSessionStatus(new Date());
  if (!session.open) {
    return NextResponse.json({
      success: true,
      skipped: true,
      reason: session.reason,
      date: session.date,
      jstTime: session.jstTime,
    });
  }

  const baseUrl = new URL(req.url).origin;
  const scanRes = await fetch(`${baseUrl}/api/scan?limit=1200`, { cache: "no-store" });
  if (!scanRes.ok) {
    return NextResponse.json({ success: false, error: "scan api failed" }, { status: 500 });
  }

  const scanJson = await scanRes.json();
  const stocks: Stock[] = Array.isArray(scanJson?.stocks) ? scanJson.stocks : [];
  const hotStocks = stocks
    .filter((stock) => Number(stock.score ?? stock.aiPower ?? 0) >= PRIME_SIGNAL_SCORE)
    .sort((a, b) => Number(b.score ?? b.aiPower ?? 0) - Number(a.score ?? a.aiPower ?? 0));

  await rearmPrimeSignals(hotStocks.map((stock) => String(stock.code)));

  const notifications = [];

  for (const stock of hotStocks) {
    const score = Number(stock.score ?? stock.aiPower ?? 0);
    const price = Number(stock.price ?? 0);
    const claimed = await claimPrimeSignal(stock.code, score);

    if (!claimed) {
      notifications.push({ code: stock.code, state: "ALREADY_HOT" });
      continue;
    }

    const push = await pushWebToAll({
      title: "👑 SIGNALX 大本命シグナル",
      body: `${stock.code} ${stock.name ?? ""}｜AI ${score}${price > 0 ? `｜現在 ${Math.round(price).toLocaleString()}円` : ""}`,
      url: `/analysis/${stock.code}`,
      tag: `signalx-prime-${stock.code}`,
    });

    if (push.ok) {
      await markPrimeSignalNotified(stock.code, score);
      notifications.push({ code: stock.code, state: "NOTIFIED", push });
    } else {
      await releasePrimeSignalClaim(stock.code);
      notifications.push({ code: stock.code, state: "RETRY", push });
    }
  }

  return NextResponse.json({
    success: true,
    threshold: PRIME_SIGNAL_SCORE,
    hotCount: hotStocks.length,
    notifications,
  });
}
