import { NextResponse } from "next/server";
import { requireCronAuth } from "@/app/lib/cronAuth";
import {
  FAVORITE_BUY_SCORE,
  getAllFavorites,
  startFavoriteAiMonitor,
} from "@/app/lib/favoriteAiMonitor";
import { favoriteBuyMessage } from "@/app/lib/line/favoriteAlerts";
import { getLineUserIdByEmail, pushLineToUser } from "@/app/lib/line/userPush";

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

  const baseUrl = new URL(req.url).origin;
  const [favorites, scanRes] = await Promise.all([
    getAllFavorites(),
    fetch(`${baseUrl}/api/scan?limit=1000`, { cache: "no-store" }),
  ]);

  if (!scanRes.ok) {
    return NextResponse.json({ success: false, error: "scan api failed" }, { status: 500 });
  }

  const scanJson = await scanRes.json();
  const stocks: Stock[] = Array.isArray(scanJson?.stocks) ? scanJson.stocks : [];
  const started = [];
  const waiting = [];

  for (const favorite of favorites) {
    const stock = stocks.find((item) => String(item.code) === favorite.code);
    const score = Number(stock?.score ?? stock?.aiPower ?? 0);
    const price = Number(stock?.price ?? 0);

    if (!stock || price <= 0 || score < FAVORITE_BUY_SCORE) {
      waiting.push({ code: favorite.code, score, reason: !stock ? "not_found" : price <= 0 ? "price_missing" : "below_buy_score" });
      continue;
    }

    const takeProfit = Number(stock.takeProfit ?? Math.round(price * 1.03));
    const stopLoss = Number(stock.stopLoss ?? Math.round(price * 0.98));
    const monitor = await startFavoriteAiMonitor({
      userEmail: favorite.userEmail,
      code: favorite.code,
      name: favorite.name || stock.name || favorite.code,
      entryPrice: price,
      aiPower: score,
      takeProfit,
      stopLoss,
    });
    if (monitor) {
      let lineSent = false;
      const lineUserId = await getLineUserIdByEmail(monitor.userEmail);
      if (lineUserId) {
        const line = await pushLineToUser(
          lineUserId,
          favoriteBuyMessage(monitor, baseUrl),
        );
        lineSent = line.ok;
      }
      started.push({ ...monitor, lineSent, lineLinked: Boolean(lineUserId) });
    }
  }

  return NextResponse.json({
    success: true,
    threshold: FAVORITE_BUY_SCORE,
    favoriteCount: favorites.length,
    startedCount: started.length,
    waitingCount: waiting.length,
    started,
    waiting,
  });
}
