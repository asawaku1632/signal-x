"use client";

import { useEffect, useState } from "react";
import TradingChart from "@/app/chart/[code]/components/TradingChart";

type Timeframe = "5m" | "15m" | "1H" | "1D" | "1W" | "1M";
type Candle = {
  time: number; open: number; high: number; low: number; close: number; volume?: number;
};
type ChartResponse = {
  success?: boolean;
  status?: string;
  currentPrice?: number | null;
  latestBarTimestamp?: number | null;
  ma20?: number | null;
  ema20?: number | null;
  vwap?: number | null;
  macd?: number | null;
  macdSignal?: number | null;
  supportPrice?: number | null;
  resistancePrice?: number | null;
  candles?: Candle[];
};
type LoadState =
  | { kind: "loading" }
  | { kind: "unavailable" }
  | { kind: "ready"; data: ChartResponse };

const timeframes: { value: Timeframe; label: string }[] = [
  { value: "5m", label: "5分" }, { value: "15m", label: "15分" },
  { value: "1H", label: "1時間" }, { value: "1D", label: "日足" },
  { value: "1W", label: "週足" }, { value: "1M", label: "月足" },
];

function validCandle(bar: Candle) {
  return Number.isFinite(bar.time) && bar.time > 0
    && [bar.open, bar.high, bar.low, bar.close].every(x => Number.isFinite(x) && x > 0)
    && bar.high >= Math.max(bar.open, bar.close, bar.low)
    && bar.low <= Math.min(bar.open, bar.close, bar.high);
}

function jstDate(timestamp: number) {
  return new Date(timestamp * 1000).toLocaleString("ja-JP", {
    timeZone: "Asia/Tokyo", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit",
  });
}

export default function InlineTradingChart({
  code,
  takeProfit,
  stopLoss,
  isFavorite,
  favoriteLoading,
  favoriteSaving,
  onToggleFavorite,
}: {
  code: string;
  takeProfit: number | null;
  stopLoss: number | null;
  isFavorite: boolean;
  favoriteLoading: boolean;
  favoriteSaving: boolean;
  onToggleFavorite: () => void;
}) {
  const [timeframe, setTimeframe] = useState<Timeframe>("5m");
  const [chart, setChart] = useState<LoadState>({ kind: "loading" });

  useEffect(() => {
    setTimeframe("5m");
  }, [code]);

  useEffect(() => {
    const controller = new AbortController();
    setChart({ kind: "loading" });

    async function load() {
      try {
        if (!/^[0-9A-Za-z]{4,5}$/.test(code)) throw new Error("invalid code");
        const res = await fetch(
          `/api/chart/${encodeURIComponent(code)}?tf=${timeframe}`,
          { cache: "no-store", signal: controller.signal },
        );
        if (!res.ok) throw new Error("chart request failed");
        const payload = (await res.json()) as ChartResponse;
        if (!payload.success || !Array.isArray(payload.candles) || !payload.candles.some(validCandle)) {
          throw new Error("no valid candles");
        }
        if (!controller.signal.aborted) setChart({ kind: "ready", data: payload });
      } catch {
        if (!controller.signal.aborted) setChart({ kind: "unavailable" });
      }
    }
    void load();
    return () => controller.abort();
  }, [code, timeframe]);

  const data = chart.kind === "ready" ? chart.data : null;
  const candles = data?.candles?.filter(validCandle) ?? [];
  const last = candles.at(-1);
  const price = data?.currentPrice != null && Number.isFinite(data.currentPrice) && data.currentPrice > 0
    ? data.currentPrice : last?.close ?? null;
  const quoteAt = data?.latestBarTimestamp ?? last?.time ?? null;
  // A returned candle can be historical; never treat a new HTTP response as fresh market data.
  const lastJstDate = quoteAt != null ? new Date(quoteAt * 1000).toLocaleDateString("sv-SE", {timeZone:"Asia/Tokyo"}) : "";
  const todayJst = new Date().toLocaleDateString("sv-SE", {timeZone:"Asia/Tokyo"});
  const oldQuote = data?.status === "stale" || !quoteAt || lastJstDate !== todayJst;
  // Use only the already displayed overview calculation, never create a new investment target.
  const pricesValid = Number.isFinite(takeProfit) && Number.isFinite(stopLoss)
    && (takeProfit ?? 0) > 0 && (stopLoss ?? 0) > 0;

  return (
    <section aria-label="本格ローソク足チャート" className="mt-2 rounded-2xl border border-blue-200 bg-white p-2 shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <div className="px-1 pb-2">
        <div className="flex items-center justify-between gap-2">
          <h2 className="min-w-0 text-base font-black text-slate-950 dark:text-white">📈 ローソク足チャート</h2>
          <button
            type="button"
            onClick={onToggleFavorite}
            disabled={favoriteLoading || favoriteSaving}
            aria-label={isFavorite ? "お気に入りから削除" : "お気に入りに追加"}
            aria-pressed={isFavorite}
            className={`inline-flex min-h-10 shrink-0 items-center gap-1 rounded-xl border px-2 text-xs font-bold shadow-sm transition active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 ${
              isFavorite
                ? "border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-300"
                : "border-slate-200 bg-white text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
            }`}
          >
            <span className="text-lg" aria-hidden="true">
              {favoriteLoading || favoriteSaving ? "…" : isFavorite ? "★" : "☆"}
            </span>
            お気に入り
          </button>
        </div>
        <div className="mt-1 flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
          <p className="text-[11px] leading-5 text-slate-600 dark:text-slate-300">
            前回参考値・支持線・抵抗線・移動平均・MACDを表示
          </p>
          <span className="shrink-0 rounded-full bg-slate-100 px-2 py-1 text-[11px] font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-200">
            Yahoo参考データ
          </span>
        </div>
      </div>
      <div role="tablist" aria-label="ローソク足の時間軸" className="grid grid-cols-6 gap-1 rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
        {timeframes.map(option => (
          <button key={option.value} type="button" role="tab" aria-selected={timeframe === option.value}
            onClick={() => setTimeframe(option.value)}
            className={`min-h-10 min-w-0 rounded-lg px-0.5 text-[11px] font-black min-[390px]:text-xs ${timeframe === option.value
              ? "bg-blue-600 text-white shadow-sm"
              : "text-slate-600 dark:text-slate-300"}`}>
            {option.label}
          </button>
        ))}
      </div>
      {chart.kind === "loading" ? (
        <div role="status" className="mt-2 grid min-h-[280px] place-items-center rounded-xl bg-slate-50 p-4 text-sm font-bold text-slate-600 dark:bg-slate-800">
          {timeframe} の実際のチャートを読み込み中…
        </div>
      ) : chart.kind === "unavailable" || !data || !candles.length ? (
        <p role="status" className="mt-2 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm font-bold leading-6 text-amber-900">
          この時間軸のデータを取得できませんでした。参考線や架空の価格は表示しません。時間軸を切り替えるか、時間をおいてご確認ください。
        </p>
      ) : (
        <>
          <p role="status" className={`mt-2 rounded-lg px-2.5 py-2 text-xs font-bold leading-5 ${oldQuote
            ? "border border-amber-200 bg-amber-50 text-amber-900"
            : "bg-slate-50 text-slate-600"}`}>
            {oldQuote ? "⚠ 前回の参考データを表示中。" : "確定済みの取得データを表示中。"}
            {" "}最終足 {quoteAt ? jstDate(quoteAt) : "取得時刻不明"}（日本時間）。
            約定価格・リアルタイムの売買サインではありません。
          </p>
          <div className="mt-2">
            {price != null && pricesValid ? (
              <TradingChart
                key={timeframe} candles={candles}
                ma20={data.ma20 ?? null} ema20={data.ema20 ?? null}
                vwap={data.vwap ?? null} macd={data.macd ?? null}
                macdSignal={data.macdSignal ?? null}
                currentPrice={price} priceLabel={oldQuote ? "前回参考値" : "参考値"}
                takeProfit={takeProfit!} stopLoss={stopLoss!}
                supportPrice={data.supportPrice ?? null}
                resistancePrice={data.resistancePrice ?? null}
              />
            ) : (
              <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs font-bold text-amber-900">
                チャートは取得できていますが、利確・損切の参考価格が不足しています。未確認の線を描画しません。
              </p>
            )}
          </div>
          <p className="mt-2 px-1 text-[11px] leading-5 text-slate-500 dark:text-slate-400">
            利確・損切は概要タブの仮試算を共有します。5分足は遅延する場合があり、
            朝9:05に利用できた価格を保証しません。実際の注文前には証券会社の価格を確認してください。
          </p>
        </>
      )}
    </section>
  );
}
