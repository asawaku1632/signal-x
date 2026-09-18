import { withSingleLineBrand } from "@/app/lib/line/brand";
import type { FavoriteAiMonitor } from "@/app/lib/favoriteAiMonitor";

function yen(value: number) {
  return `${Math.round(value).toLocaleString()}円`;
}

export function favoriteBuyMessage(monitor: FavoriteAiMonitor, publicUrl: string) {
  return withSingleLineBrand(
    `🟢 お気に入り銘柄が買い条件成立\n\n` +
    `${monitor.code} ${monitor.name}\n` +
    `AI POWER ${monitor.aiPower}\n\n` +
    `💹 基準価格 ${yen(monitor.entryPrice)}\n` +
    `🎯 利確目標 ${yen(monitor.takeProfit)}\n` +
    `🛡 損切ライン ${yen(monitor.stopLoss)}\n\n` +
    `SIGNALXがここから監視します。\n\n` +
    `👇 個別AI解析\n${publicUrl}/analysis/${monitor.code}`
  );
}

export function favoriteResultMessage(
  monitor: FavoriteAiMonitor,
  currentPrice: number,
  result: "WIN" | "LOSE",
  publicUrl: string,
) {
  const amount = Math.round(Math.abs(currentPrice - monitor.entryPrice) * 100);
  const win = result === "WIN";
  return withSingleLineBrand(
    `${win ? "🎯 利確到達" : "🛡 損切到達"}\n\n` +
    `${monitor.code} ${monitor.name}\n\n` +
    `【買い条件成立時】${yen(monitor.entryPrice)}\n` +
    `【現在値】${yen(currentPrice)}\n` +
    `【${win ? "利確" : "損切"}ライン】${yen(win ? monitor.takeProfit : monitor.stopLoss)}\n\n` +
    `【100株換算】${win ? "+" : "-"}${yen(amount)}\n\n` +
    `👇 個別AI解析\n${publicUrl}/analysis/${monitor.code}`
  );
}
