import { after } from "next/server";
import {
  getDisplaySnapshot,
  saveDisplaySnapshot,
} from "@/app/lib/displaySnapshot";
import {
  getLatestScanSnapshot,
  refreshScanSnapshot,
  SCAN_FRESH_MS,
} from "@/app/lib/scanSnapshot";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const MARKET_KEY = "today-market:latest";

// Stored scan rows contain versioned, extensible score fields.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function power(stock: any) {
  return Number(stock?.score ?? stock?.aiPower ?? stock?.power ?? stock?.totalScore ?? 0);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function expected(stock: any) {
  if (stock?.expected) return String(stock.expected);
  if (stock?.expectedProfit) return String(stock.expectedProfit);
  const takeProfit = Number(stock?.takeProfit);
  const price = Number(stock?.price);
  return Number.isFinite(takeProfit) && Number.isFinite(price) && price > 0
    ? `+${(((takeProfit - price) / price) * 100).toFixed(1)}%`
    : "+0.0%";
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildMarketPayload(stocks: any[]) {
  const normalized = [...stocks]
    .filter(Boolean)
    .sort((a, b) => power(b) - power(a))
    .map((stock) => ({
      ...stock,
      code: String(stock?.code ?? ""),
      name: String(stock?.name ?? "名称不明"),
      score: power(stock),
      aiPower: power(stock),
      expected: expected(stock),
    }));
  if (!normalized.length) return null;
  const top = normalized[0];
  const topPower = power(top);
  const grade = topPower >= 80 ? "A" : topPower >= 75 ? "B" : topPower >= 65 ? "C" : "D";
  const action = grade === "A" ? "攻める日" : grade === "B" ? "慎重に攻める日" : grade === "C" ? "厳選の日" : "休む日";
  const marketCondition = grade === "A" ? "強気" : grade === "B" ? "やや強気" : grade === "C" ? "中立" : "弱気";
  const judge = topPower >= 80 ? "買い候補" : topPower >= 75 ? "押し目待ち" : topPower >= 65 ? "様子見" : "見送り";

  return {
    success: true,
    grade,
    action,
    marketCondition,
    hotCount: normalized.filter((stock) => power(stock) >= 75).length,
    watchCount: normalized.filter((stock) => power(stock) >= 65 && power(stock) < 75).length,
    top5: normalized.slice(0, 5).map((stock, index) => ({
      rank: index + 1,
      code: stock.code,
      name: stock.name,
      aiPower: stock.aiPower,
      score: stock.score,
      price: stock.price ?? null,
      changePercent: stock.changePercent ?? null,
      reason: stock.reason ?? "",
      expected: stock.expected,
    })),
    stocks: normalized,
    topStock: {
      code: top.code,
      name: top.name,
      aiPower: topPower,
      expected: expected(top),
      judge,
    },
    strategy: grade === "D"
      ? ["無理に買わない", "現金を守る", "次の好機を待つ"]
      : ["押し目買い", "AI POWER上位を確認", "高値掴みを避ける"],
    avoid: ["高値追い", "飛び乗り", "無理なエントリー"],
    comment: grade === "D"
      ? "今日は強い買い候補が少ないため、無理に売買せず次の好機を待つ戦略が有効です。"
      : `本日の大本命は${top.code} ${top.name}です。AI POWERは${topPower}。高値追いは避け、押し目を待ちながら慎重に判断しましょう。`,
  };
}

async function rebuildMarketSnapshot() {
  await refreshScanSnapshot(20);
  const scan = await getLatestScanSnapshot();
  const payload = scan ? buildMarketPayload(scan.payload.stocks.slice(0, 20)) : null;
  if (!payload) return null;
  return saveDisplaySnapshot(
    MARKET_KEY,
    { ...payload, dataUpdatedAt: scan?.updatedAt },
    payload.stocks.length,
  );
}

export async function GET() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let snapshot = await getDisplaySnapshot<any>(MARKET_KEY);
  if (!snapshot) {
    const scan = await getLatestScanSnapshot();
    const payload = scan ? buildMarketPayload(scan.payload.stocks.slice(0, 20)) : null;
    if (payload) {
      snapshot = await saveDisplaySnapshot(
        MARKET_KEY,
        { ...payload, dataUpdatedAt: scan?.updatedAt },
        payload.stocks.length,
      );
    }
  }

  const dataUpdatedAt = snapshot?.payload.dataUpdatedAt ?? snapshot?.updatedAt;
  const ageMs = dataUpdatedAt ? Date.now() - Date.parse(dataUpdatedAt) : Infinity;
  if (!snapshot || ageMs >= SCAN_FRESH_MS) {
    after(async () => {
      await rebuildMarketSnapshot().catch((error) =>
        console.error("today market refresh failed:", error),
      );
    });
  }

  if (!snapshot) {
    return Response.json({
      success: true,
      status: "loading",
      updatedAt: null,
      hotCount: null,
      watchCount: null,
      topStock: null,
      top5: [],
    }, { status: 202 });
  }

  return Response.json({
    ...snapshot.payload,
    status: ageMs < SCAN_FRESH_MS ? "fresh" : "stale",
    updatedAt: dataUpdatedAt,
  });
}
