import { NextResponse } from "next/server";
import { requireCronAuth } from "@/app/lib/cronAuth";
import {
  claimFavoriteActivationNotification,
  claimFavoriteResultNotification,
  getActiveFavoriteAiMonitors,
  getPendingFavoriteResultNotifications,
  markFavoriteActivationNotified,
  markFavoriteResultNotified,
  recordFavoriteAiOutcome,
  releaseFavoriteActivationNotification,
  releaseFavoriteResultNotification,
} from "@/app/lib/favoriteAiMonitor";
import { favoriteBuyMessage, favoriteResultMessage } from "@/app/lib/line/favoriteAlerts";
import { getLineUserIdByEmail, pushLineToUser } from "@/app/lib/line/userPush";

type Stock = { code: string; price?: number };
const lineDeliveryEnabled = process.env.FAVORITE_LINE_ALERTS_ENABLED === "true";

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
      if (lineDeliveryEnabled && lineUserId) {
        const claimed = await claimFavoriteActivationNotification(monitor.id);
        if (claimed) {
          const line = await pushLineToUser(lineUserId, favoriteBuyMessage(monitor, baseUrl));
          if (line.ok) await markFavoriteActivationNotified(monitor.id);
          else await releaseFavoriteActivationNotification(monitor.id);
        }
      }
    }

    if (currentPrice <= 0) {
      active.push({ ...monitor, currentPrice: 0, state: "PRICE_MISSING" });
      continue;
    }

    const outcome =
      currentPrice >= monitor.takeProfit ? "WIN" :
      currentPrice <= monitor.stopLoss ? "LOSE" : null;

    if (outcome) {
      const result = await recordFavoriteAiOutcome(monitor.id, outcome, currentPrice);
      if (result) completed.push({ ...result, currentPrice, lineSent: false });
      continue;
    }

    active.push({ ...monitor, currentPrice, state: "ACTIVE" });
  }

  const pending = await getPendingFavoriteResultNotifications();
  const notifications = [];

  for (const monitor of pending) {
    const currentPrice = monitor.resultPrice;
    if (currentPrice == null) continue;

    const lineUserId = await getLineUserIdByEmail(monitor.userEmail);
    if (!lineDeliveryEnabled || !lineUserId) {
      notifications.push({
        id: monitor.id,
        code: monitor.code,
        state: "RESULT_SAVED_NOTIFICATION_PENDING",
        lineLinked: Boolean(lineUserId),
      });
      continue;
    }

    const claimed = await claimFavoriteResultNotification(monitor.id);
    if (!claimed) {
      notifications.push({ id: monitor.id, code: monitor.code, state: "NOTIFICATION_IN_PROGRESS" });
      continue;
    }

    const result = monitor.status === "WIN" ? "WIN" : "LOSE";
    const line = await pushLineToUser(
      lineUserId,
      favoriteResultMessage(monitor, currentPrice, result, baseUrl),
    );

    if (line.ok) {
      await markFavoriteResultNotified(monitor.id);
      notifications.push({ id: monitor.id, code: monitor.code, state: "NOTIFIED" });
    } else {
      await releaseFavoriteResultNotification(monitor.id);
      notifications.push({ id: monitor.id, code: monitor.code, state: "NOTIFICATION_RETRY" });
    }
  }

  return NextResponse.json({
    success: true,
    checkedCount: monitors.length,
    completedCount: completed.length,
    activeCount: active.length,
    pendingNotificationCount: pending.length,
    completed,
    active,
    notifications,
    lineDeliveryEnabled,
  });
}
