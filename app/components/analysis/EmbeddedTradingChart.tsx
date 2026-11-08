"use client";

import { useEffect, useState } from "react";
import TradingChart from "@/app/chart/[code]/components/TradingChart";

type Timeframe = "5m" | "15m" | "1H" | "1D" | "1W" | "1M";

const TIMEFRAMES: ReadonlyArray<{ value: Timeframe; label: string }> = [
  { value: "5m", label: "5分" },
  { value: "15m", label: "15分" },
  { value: "1H", label: "1時間" },
  { value: "1D", label: "日足" },
  { value: "1W", label: "週足" },
  { value: "1M", label: "月足" },
];

type Candle = {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
};
type ChartResponse = {
  success?: boolean;
  status?: string;
  candles?: Candle[];
  currentPrice?: number | null;
  latestBarTimestamp?: number | null;
  ma20?: number | null;
  ema20?: number | null;
  vwap?: number | null;
  macd?: number | null;
  macdSignal?: number | null;
  supportPrice?: number | null;
  resistancePrice?: number | null;
};
type ChartState =
  | { kind: "loading" }
  | { kind: "error" }
  | { kind: "ready"; data: ChartResponse & { candles: Candle[] } };

const positive = (value: number | null | undefined): value is number =>
  typeof value === "number" && Number.isFinite(value) && value > 0;

const dateJst = (timestamp: number) => new Date(timestamp * 1000).toLocaleDateString(
  "sv-SE", { timeZone: "Asia/Tokyo" },
);

const asOfJst = (timestamp: number) => new Date(timestamp * 1000).toLocaleString(
  "ja-JP", {
    timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit",
    day: "2-digit", hour: "2-digit", minute: "2-digit",
  },
);

function validCandle(value: unknown): value is Candle {
  if (!value || typeof value !== "object") return false;
  const candle = value as Partial<Candle>;
  return positive(candle.open) && positive(candle.high) && positive(candle.low) && positive(candle.close)
    && Number.isFinite(candle.time) && Number(candle.time) > 0
    && Number(candle.high) >= Math.max(Number(candle.open), Number(candle.close), Number(candle.low))
    && Number(candle.low) <= Math.min(Number(candle.open), Number(candle.close), Number(candle.high));
}

/**
 * The same interactive TradingChart component and API used by /chart/[code].
 * Reference labels are deliberately conservative. This is NOT a live quote.
 */
export default function EmbeddedTradingChart({
  code,
  referencePrice,
  referenceTakeProfit,
  referenceStopLoss,
}: {
  code: string;
  referencePrice: number | null;
  referenceTakeProfit: number | null;
  referenceStopLoss: number | null;
}) {
  const [timeframe, setTimeframe] = useState<Timeframe>("5m");
  const [result, setResult] = useState<ChartState>({ kind: "loading" });

  useEffect(() => {
    const controller = new AbortController();
    setResult({ kind: "loading" });

    const load = async () => {
      try {
        const response = await fetch(`/api/chart/${encodeURIComponent(code)}?tf=${timeframe}`, {
          cache: "no-store",
          signal: controller.signal,
        });
        if (!response.ok) throw new Error("chart unavailable");
        const payload = await response.json() as ChartResponse;
        if (!payload.success || !Array.isArray(payload.candles)) throw new Error("invalid chart response");
        const candles = payload.candles.filter(validCandle);
        if (!candles.length) throw new Error("no valid candles");
        if (!controller.signal.aborted) {
          setResult({ kind: "ready", data: { ...payload, candles } });
        }
      } catch {
        if (!controller.signal.aborted) setResult({ kind: "error" });
      }
    };

    void load();
    return () => controller.abort();
  }, [code, timeframe]);

  const chart = result.kind === "ready" ? result.data : null;
  const last = chart?.candles.at(-1) ?? null;
  const latestReferencePrice = chart?.currentPrice ?? null;
  const displayPrice = positive(latestReferencePrice)
    ? latestReferencePrice
    : positive(referencePrice) ? referencePrice : (last?.close ?? null);
  const quoteTime = chart?.latestBarTimestamp ?? last?.time ?? null;
  const previousDay = quoteTime === null || dateJst(quoteTime) !== dateJst(Date.now() / 1000);
  const quoteLabel = previousDay || chart?.status === "stale" ? "前回参考値" : "Yahoo参考値";
  const profit = positive(referenceTakeProfit) ? referenceTakeProfit
    : positive(displayPrice) ? Math.round(displayPrice * 1.03) : null;
  const loss = positive(referenceStopLoss) ? referenceStopLoss
    : positive(displayPrice) ? Math.round(displayPrice * 0.98) : null;

  return (
    <section aria-label="操作できる本格チャート"
      className="mt-2 rounded-2xl border border-blue-200 bg-white p-2.5 shadow-sm dark:border-blue-900 dark:bg-slate-900 sm:p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-black text-slate-900 dark:text-white">📈 本格ローソク足チャート</h2>
        <span className="rounded-full bg-slate-100 px-2 py-1 text-[11px] font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
          Yahoo Finance参考データ
        </span>
      </div>
      <p className="mt-1 text-xs leading-5 text-slate-600 dark:text-slate-300">
        時間足を切り替えたり、ピンチで拡大・左右スワイプできます。
      </p>
      <div role="tablist" aria-label="チャートの時間足"
        className="mt-3 grid grid-cols-6 gap-1 rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
        {TIMEFRAMES.map(item => (
          <button type="button" key={item.value} role="tab"
            aria-selected={timeframe === item.value}
            aria-label={item.label + "に切り替え"}
            disabled={result.kind === "loading" && timeframe === item.value}
            onClick={() => {
              if (timeframe === item.value) return;
              setResult({ kind: "loading" });
              setTimeframe(item.value);
            }}
            className={`min-h-11 min-w-0 rounded-lg px-0.5 text-[11px] font-black min-[390px]:text-sm ${timeframe === item.value
              ? "bg-blue-600 text-white shadow-sm"
              : "text-slate-600 hover:bg-white dark:text-slate-200 dark:hover:bg-slate-700"}`}>
            {item.label}
          </button>
        ))}
      </div>

      {result.kind === "loading" && (
        <p role="status" className="mt-3 rounded-xl bg-slate-50 px-3 py-8 text-center text-sm font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-200">
          {timeframe}のローソク足を読み込み中…
        </p>
      )}
      {result.kind === "error" && (
        <p role="status" className="mt-3 rounded-xl border border-amber-300 bg-amber-50 px-3 py-5 text-sm font-bold text-amber-900">
          この時間足は取得できませんでした。別の時間足か、上の青いボタンから詳細チャートを確認してください。
        </p>
      )}
      {chart && positive(displayPrice) && positive(profit) && positive(loss) && (
        <div className="mt-2">
          <p className="mb-2 rounded-lg bg-amber-50 px-2 py-2 text-xs font-bold leading-5 text-amber-900">
            ⚠ {quoteLabel}・最終足：{quoteTime !== null ? asOfJst(quoteTime) : "取得時刻不明"}。
            リアルタイムの約定価格ではありません。利確・損切は概要の参考試算値です。
          </p>
          <TradingChart
            key={code + "-" + timeframe}
            candles={chart.candles}
            ma20={chart.ma20 ?? null}
            ema20={chart.ema20 ?? null}
            vwap={chart.vwap ?? null}
            macd={chart.macd ?? null}
            macdSignal={chart.macdSignal ?? null}
            currentPrice={displayPrice}
            priceLabel={quoteLabel}
            takeProfit={profit}
            stopLoss={loss}
            supportPrice={chart.supportPrice ?? null}
            resistancePrice={chart.resistancePrice ?? null}
          />
        </div>
      )}
      {chart && (!positive(displayPrice) || !positive(profit) || !positive(loss)) && (
        <p role="status" className="mt-3 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          チャートの価格データが不足しています。価格線を推測して表示しません。
        </p>
      )}
      <p className="mt-2 text-[11px] leading-5 text-slate-500 dark:text-slate-400">
        支持線・抵抗線は参考計算値です。保存データのため、9:05以降の売買判断には実際の受信時刻と最新値の再確認が必要です。
      </p>
    </section>
  );
}
