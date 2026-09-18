import { NextResponse } from "next/server";
import { requireCronAuth } from "@/app/lib/cronAuth";
import {
  claimFavoriteResultNotification,
  completeFavoriteAiMonitor,
  getActiveFavoriteAiMonitors,
  markFavoriteActivationNotified,
  releaseFavoriteResultNotification,
} from "@/app/lib/favoriteAiMonitor";
import { favoriteBuyMessage, favoriteResultMessage } from "@/app/lib/line/favoriteAlerts";
import { getLineUserIdByEmail, pushLineToUser } from "@/app/lib/line/userPush";

type Stock = { code: string; price?: number };

export async function GET(req: Request) {
  const unauthorized = requireCronAuth(req);
  if (unauthorized) return unauthorized;

  const baseUrl = new URL(req.url).origin;
  const [monitors, scanRes] = await Promise.all([
    getActiveFavoriteAiMonitors(),
    fetch(`${baseUrl}/api/scan?limit=1000`, { cache: "no-store" }),
  ]);

  if (!scanRes.ok) {
    return NextResponse.json({ success: false, error: "scan api failed" }, { status: 500 });
  }

  const scanJson = await scanRes.json();
  const stocks: Stock[] = Array.isArray(scanJson?.stocks) ? scanJson.stocks : [];
  const completed = [];
  const active = [];

  for (const monitor of monitors) {
    const stock = stocks.find((item) => String(item.code) === monitor.code);
    const currentPrice = Number(stock?.price ?? 0);

    if (!monitor.activationNotifiedAt) {
      const lineUserId = await getLineUserIdByEmail(monitor.userEmail);
      if (lineUserId) {
        const line = await pushLineToUser(
          lineUserId,
          favoriteBuyMessage(monitor, baseUrl),
        );
        if (line.ok) {
          await markFavoriteActivationNotified(monitor.id);
        } else {
          active.push({ ...monitor, currentPrice, state: "ACTIVATION_NOTIFICATION_RETRY" });
          continue;
        }
      }
    }

    if (currentPrice <= 0) {
      active.push({ ...monitor, currentPrice: 0, state: "PRICE_MISSING" });
      continue;
    }

    if (currentPrice >= monitor.takeProfit) {
      const claimed = await claimFavoriteResultNotification(monitor.id);
      if (!claimed) {
        active.push({ ...monitor, currentPrice, state: "WIN_NOTIFICATION_IN_PROGRESS" });
        continue;
      }
      const lineUserId = await getLineUserIdByEmail(monitor.userEmail);
      const line = lineUserId
        ? await pushLineToUser(lineUserId, favoriteResultMessage(monitor, currentPrice, "WIN", baseUrl))
        : null;
      if (line?.ok) {
        const result = await completeFavoriteAiMonitor(monitor.id, "WIN");
        if (result) completed.push({ ...result, currentPrice, lineSent: true });
      } else {
        await releaseFavoriteResultNotification(monitor.id);
        active.push({ ...monitor, currentPrice, state: "WIN_PENDING_NOTIFICATION", lineLinked: Boolean(lineUserId) });
      }
      continue;
    }

    if (currentPrice <= monitor.stopLoss) {
      const claimed = await claimFavoriteResultNotification(monitor.id);
      if (!claimed) {
        active.push({ ...monitor, currentPrice, state: "LOSE_NOTIFICATION_IN_PROGRESS" });
        continue;
      }
      const lineUserId = await getLineUserIdByEmail(monitor.userEmail);
      const line = lineUserId
        ? await pushLineToUser(lineUserId, favoriteResultMessage(monitor, currentPrice, "LOSE", baseUrl))
        : null;
      if (line?.ok) {
        const result = await completeFavoriteAiMonitor(monitor.id, "LOSE");
        if (result) completed.push({ ...result, currentPrice, lineSent: true });
      } else {
        await releaseFavoriteResultNotification(monitor.id);
        active.push({ ...monitor, currentPrice, state: "LOSE_PENDING_NOTIFICATION", lineLinked: Boolean(lineUserId) });
      }
      continue;
    }

    active.push({ ...monitor, currentPrice, state: "ACTIVE" });
  }

  return NextResponse.json({
    success: true,
    checkedCount: monitors.length,
    completedCount: completed.length,
    activeCount: active.length,
    completed,
    active,
    lineDeliveryEnabled: true,
  });
}
