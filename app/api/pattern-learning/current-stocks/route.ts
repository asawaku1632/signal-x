import { NextResponse } from "next/server";
import { getLatestScanSnapshot } from "@/app/lib/scanSnapshot";

export const dynamic = "force-dynamic";

const CACHE_TTL_MS = 60_000;
const responseCache = new Map<string, { expiresAt: number; body: unknown }>();

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
  const filters = (["rsi", "macd", "vwap", "ema20", "trend"] as ConditionGroup[])
    .map((key) => [key, url.searchParams.get(key)] as const)
    .filter((entry): entry is readonly [ConditionGroup, string] => Boolean(entry[1]));
  const limit = Math.min(Math.max(Number(url.searchParams.get("limit") || 100), 1), 200);

  const singleFilterValid =
    group && allowed[group] && value && allowed[group].has(value);
  const multiFilterValid =
    filters.length > 0 && filters.every(([key, selected]) => allowed[key].has(selected));

  if (!singleFilterValid && !multiFilterValid) {
    return NextResponse.json({ success: false, error: "INVALID_CONDITION" }, { status: 400 });
  }

  const activeFilters: Array<[ConditionGroup, string]> = multiFilterValid
    ? filters.map(([key, selected]) => [key, selected])
    : [[group as ConditionGroup, value as string]];

  const cacheKey = `${activeFilters.map(([key, selected]) => `${key}:${selected}`).join("|")}:${limit}`;
  const cached = responseCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return NextResponse.json(cached.body, {
      headers: { "Cache-Control": "private, max-age=30" },
    });
  }

  const snapshot = await getLatestScanSnapshot();
  const stocks = Array.isArray(snapshot?.payload?.stocks) ? snapshot.payload.stocks : [];
  const matched = stocks
    .filter((stock: any) =>
      activeFilters.every(([key, selected]) => conditionKey(stock, key) === selected),
    )
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

  const body = {
    success: true,
    group: group ?? null,
    value: value ?? null,
    filters: Object.fromEntries(activeFilters),
    totalMatched: matched.length,
    snapshotUpdatedAt: snapshot?.updatedAt ?? null,
    stocks: matched,
  };

  responseCache.set(cacheKey, { expiresAt: Date.now() + CACHE_TTL_MS, body });

  return NextResponse.json(body, {
    headers: { "Cache-Control": "private, max-age=30" },
  });
}
