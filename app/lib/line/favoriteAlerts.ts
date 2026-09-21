import { withSingleLineBrand } from "@/app/lib/line/brand";
import type { FavoriteAiMonitor } from "@/app/lib/favoriteAiMonitor";

function yen(value: number) {
  return `${Math.round(value).toLocaleString()}円`;
}

const MAX_ENTRY_CHASE_RATE = 0.01;

function entryGuide(entryPrice: number, currentPrice: number) {
  const upper = Math.round(entryPrice * (1 + MAX_ENTRY_CHASE_RATE));
  if (currentPrice <= upper) {
    return `🟢 エントリー範囲内\n目安上限 ${yen(upper)}（基準価格 +1%以内）`;
  }
  const rate = ((currentPrice / entryPrice - 1) * 100).toFixed(1);
  return `⚠️ 上昇しすぎ・追いかけ買い注意\n基準価格から +${rate}%（目安上限 ${yen(upper)}）`;
}

export function favoriteBuyMessage(monitor: FavoriteAiMonitor, publicUrl: string, currentPrice = monitor.entryPrice) {
  return withSingleLineBrand(
    `🟢 お気に入り銘柄が買い条件成立\n\n` +
    `${monitor.code} ${monitor.name}\n` +
    `AI POWER ${monitor.aiPower}\n\n` +
    `💹 基準価格 ${yen(monitor.entryPrice)}\n` +
    `🎯 利確目標 ${yen(monitor.takeProfit)}\n` +
    `🛡 損切ライン ${yen(monitor.stopLoss)}\n\n` +
    `${entryGuide(monitor.entryPrice, currentPrice)}\n\n` +
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
