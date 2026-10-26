import { NextResponse } from "next/server";
import { recordFavoriteAlertAudit } from "@/app/lib/favoriteAlertAudit";
import { quoteDateJst } from "@/app/lib/marketScanGuard";
import { favoriteQuoteFreshness } from "@/app/lib/favoriteQuoteFreshness";
import { requireCronAuth } from "@/app/lib/cronAuth";
import {
  FAVORITE_BUY_SCORE,
  claimFavoriteActivationNotification,
  completeFavoriteAiMonitor,
  getAllFavorites,
  getFavoriteAiWatchState,
  markFavoriteActivationNotified,
  releaseFavoriteActivationNotification,
  setFavoriteAiWatchState,
  startFavoriteAiMonitor,
} from "@/app/lib/favoriteAiMonitor";
import { favoriteBuyMessage } from "@/app/lib/line/favoriteAlerts";
import { getLineUserIdByEmail, pushLineToUser } from "@/app/lib/line/userPush";
import { pushWebToUser } from "@/app/lib/push/userPush";
import { getTseCashSessionStatus } from "@/app/lib/technicalObservation/tseMarketCalendar";
import { PRIME_SIGNAL_SCORE } from "@/app/lib/primeSignalState";

type Stock = {
  code: string;
  name?: string;
  price?: number;
  score?: number;
  aiPower?: number;
  takeProfit?: number;
  stopLoss?: number;
  latestBarTimestamp?: number | string | null;
};

const lineDeliveryEnabled = process.env.FAVORITE_LINE_ALERTS_ENABLED === "true";

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
  const [favorites, scanRes] = await Promise.all([
    getAllFavorites(),
    fetch(`${baseUrl}/api/scan?limit=1000`, { cache: "no-store" }),
  ]);

  if (!scanRes.ok) {
    return NextResponse.json({ success: false, error: "scan api failed" }, { status: 500 });
  }

  const scanJson = await scanRes.json();
  const stocks: Stock[] = Array.isArray(scanJson?.stocks) ? scanJson.stocks : [];
  const marketDate = session.date;
  const started = [];
  const waiting = [];

  for (const favorite of favorites) {
    const stock = stocks.find((item) => String(item.code) === favorite.code);
    const score = Number(stock?.score ?? stock?.aiPower ?? 0);
    const price = Number(stock?.price ?? 0);

    if (!stock || price <= 0) {
      waiting.push({ code: favorite.code, score, reason: !stock ? "not_found" : "price_missing" });
      continue;
    }

    // A fresh scan snapshot does not imply a fresh underlying market quote.
    // Fail closed when the per-stock quote date is missing or not today.
    const quoteTime = stock.latestBarTimestamp;
    const quoteDate = quoteDateJst(quoteTime);
    if (quoteDate !== marketDate) {
      waiting.push({ code: favorite.code, score, reason: "quote_not_confirmed_today", quoteDate, marketDate });
      continue;
    }

    const freshness = favoriteQuoteFreshness(quoteTime);
    if (!freshness.ok) {
      waiting.push({ code: favorite.code, score, reason: freshness.reason, quoteAgeSeconds: freshness.ageSeconds });
      continue;
    }

    const watchState = await getFavoriteAiWatchState(favorite.userEmail, favorite.code);

    if (score < FAVORITE_BUY_SCORE) {
      if (watchState === "DISARMED") {
        await setFavoriteAiWatchState(favorite.userEmail, favorite.code, "ARMED");
      }
      waiting.push({ code: favorite.code, score, reason: "below_buy_score", watchState: "ARMED" });
      continue;
    }

    if (watchState === "DISARMED") {
      waiting.push({ code: favorite.code, score, reason: "waiting_for_rearm", watchState });
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
      try {
        await recordFavoriteAlertAudit({
          monitorId: monitor.id,
          code: monitor.code,
          quoteTimestamp: new Date(Number(quoteTime) * 1000).toISOString(),
          snapshotUpdatedAt: typeof scanJson?.updatedAt === "string" && !Number.isNaN(Date.parse(scanJson.updatedAt)) ? scanJson.updatedAt : null,
          decisionAt: new Date().toISOString(),
          referencePrice: price,
          aiPower: score,
        });
      } catch (error) {
        // Never deliver an alert when its quote provenance cannot be recorded.
        // Cancel the newly created monitor so the next cron can retry safely.
        await completeFavoriteAiMonitor(monitor.id, "CANCELLED");
        waiting.push({ code: favorite.code, score, reason: "audit_persist_failed" });
        console.error("favorite alert audit failed", { code: favorite.code, error });
        continue;
      }
      await setFavoriteAiWatchState(favorite.userEmail, favorite.code, "DISARMED");
      let lineSent = false;
      const lineUserId = await getLineUserIdByEmail(monitor.userEmail);
      if (lineDeliveryEnabled && lineUserId) {
        const claimed = await claimFavoriteActivationNotification(monitor.id);
        if (claimed) {
          const line = await pushLineToUser(
            lineUserId,
            favoriteBuyMessage(monitor, baseUrl),
          );
          lineSent = line.ok;
          if (line.ok) {
            await markFavoriteActivationNotified(monitor.id);
          } else {
            await releaseFavoriteActivationNotification(monitor.id);
          }
        }
      }
      const webPush = score >= PRIME_SIGNAL_SCORE
        ? { ok: false, sent: 0, failed: 0, reason: "PRIME_SIGNAL_PRIORITY" as const }
        : await pushWebToUser(monitor.userEmail, {
            title: "🔵 SIGNALX 高評価・監視候補",
            body: `${monitor.code} ${monitor.name}｜AI ${monitor.aiPower}｜基準 ${Math.round(monitor.entryPrice).toLocaleString()}円｜利確 ${Math.round(monitor.takeProfit).toLocaleString()}円｜損切 ${Math.round(monitor.stopLoss).toLocaleString()}円`,
            url: `/analysis/${monitor.code}`,
            tag: `signalx-buy-${monitor.id}`,
          }, "buy");
      started.push({ ...monitor, lineSent, lineLinked: Boolean(lineUserId), webPush });
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
    lineDeliveryEnabled,
  });
}
