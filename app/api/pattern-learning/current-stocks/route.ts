import { NextResponse } from "next/server";
import { getLatestScanSnapshot } from "@/app/lib/scanSnapshot";

export const dynamic = "force-dynamic";

type ConditionGroup = "rsi" | "macd" | "vwap" | "ema20" | "trend";

const allowed: Record<ConditionGroup, Set<string>> = {
  rsi: new Set(["RSI_UNDER_30","RSI_30_44","RSI_45_60","RSI_61_75","RSI_76_85","RSI_OVER_85"]),
  macd: new Set(["MACD_GC","MACD_DC","MACD_NO_DATA"]),
  vwap: new Set(["VWAP_ABOVE","VWAP_BELOW","VWAP_NO_DATA"]),
  ema20: new Set(["EMA20_ABOVE","EMA20_BELOW","EMA20_NO_DATA"]),
  trend: new Set(["TREND_UP","TREND_DOWN","TREND_NO_DATA"]),
};

function finite(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function rsiKey(stock: any) {
  const rsi = finite(stock?.rsi);
  if (rsi === null) return null;
  if (rsi < 30) return "RSI_UNDER_30";
  if (rsi <= 44) return "RSI_30_44";
  if (rsi <= 60) return "RSI_45_60";
  if (rsi <= 75) return "RSI_61_75";
  if (rsi <= 85) return "RSI_76_85";
  return "RSI_OVER_85";
}

function conditionKey(stock: any, group: ConditionGroup) {
  if (group === "rsi") return rsiKey(stock);
  const direct = stock?.patternLearning?.[group === "ema20" ? "ema20Key" : `${group}Key`];
  if (typeof direct === "string") return direct;

  const patternKey = stock?.patternLearning?.patternKey ?? stock?.patternKey;
  if (typeof patternKey === "string") {
    return patternKey.split("|").find((part: string) => allowed[group].has(part)) ?? null;
  }
  return null;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const group = url.searchParams.get("group") as ConditionGroup | null;
  const value = url.searchParams.get("value");
  const limit = Math.min(Math.max(Number(url.searchParams.get("limit") || 100), 1), 200);

  if (!group || !allowed[group] || !value || !allowed[group].has(value)) {
    return NextResponse.json({ success: false, error: "INVALID_CONDITION" }, { status: 400 });
  }

  const snapshot = await getLatestScanSnapshot();
  const stocks = Array.isArray(snapshot?.payload?.stocks) ? snapshot.payload.stocks : [];
  const matched = stocks
    .filter((stock: any) => conditionKey(stock, group) === value)
    .slice(0, limit)
    .map((stock: any) => ({
      code: stock.code,
      name: stock.name,
      price: stock.price,
      changePercent: stock.changePercent,
      aiPower: stock.rawAiPower ?? stock.score ?? stock.aiPower ?? 0,
      rsi: stock.rsi ?? null,
      volumeRatio: stock.volumeRatio ?? null,
    }));

  return NextResponse.json({
    success: true,
    group,
    value,
    totalMatched: matched.length,
    snapshotUpdatedAt: snapshot?.updatedAt ?? null,
    stocks: matched,
  });
}
