import "server-only";
import { joinCrashIndexSeries, parseCrashIndexDaily } from "./crashStrengthMarketReference.mjs";

const REFERENCE_TIMEOUT_MS = 7_000;
const URL_PREFIX = "https://query1.finance.yahoo.com/v8/finance/chart/";
const REFERENCE_OPTIONS = [
  { key: "nikkei", ticker: "^N225" },
  { key: "topix", ticker: "998405.T" },
] as const;

// Reference only. No orders, notifications, DB writes, or new Cron.
async function getDailyReference(ticker: string) {
  const url = URL_PREFIX + encodeURIComponent(ticker) + "?range=6mo&interval=1d";
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 SIGNALX research" },
    next: { revalidate: 1800 },
    signal: AbortSignal.timeout(REFERENCE_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error("REFERENCE_HTTP_" + res.status);
  return parseCrashIndexDaily(await res.json());
}

export async function getCrashMarketReferences(asOf: string) {
  const settled = await Promise.allSettled(REFERENCE_OPTIONS.map(x => getDailyReference(x.ticker)));
  const nikkei = settled[0].status === "fulfilled" ? settled[0].value : [];
  const topix = settled[1].status === "fulfilled" ? settled[1].value : [];
  return {
    marketRows: joinCrashIndexSeries({ nikkei, topix, asOf }),
    source: "Yahoo Finance確定日足の参考終値（6か月）",
    nikkeiAvailable: nikkei.length > 0,
    topixAvailable: topix.length > 0,
    // Failure must be visible: an absent index is not evidence of a calm market.
    referenceAvailable: nikkei.length > 0 || topix.length > 0,
    note: nikkei.length > 0 || topix.length > 0
      ? "参考指数の欠損日や株価保存欠損日は検証対象から除外します。"
      : "指数参考値が取得できません。暴落なしとは判定できません。",
  };
}
