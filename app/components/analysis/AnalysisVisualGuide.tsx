"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type DailyCandle = {
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
  candles?: DailyCandle[];
};
type ChartState =
  | { kind: "loading" }
  | { kind: "unavailable" }
  | { kind: "ready"; candles: DailyCandle[]; stale: boolean };

const yen = (price: number) => Math.round(price).toLocaleString("ja-JP") + "円";
const jstDate = (value: number | Date) => new Date(
  typeof value === "number" ? value * 1000 : value.getTime(),
).toLocaleDateString("sv-SE", { timeZone: "Asia/Tokyo" });

function isCompletedDay(time: number, now: Date) {
  const barDay = jstDate(time);
  const today = jstDate(now);
  if (barDay < today) return true;
  if (barDay > today) return false;
  // Do not plot a partially formed candle during market hours.
  const hour = Number(now.toLocaleTimeString("en-GB", {
    timeZone: "Asia/Tokyo", hour: "2-digit", hour12: false,
  }).slice(0, 2));
  return hour >= 16;
}

function validCandle(value: unknown): value is DailyCandle {
  if (!value || typeof value !== "object") return false;
  const candle = value as Partial<DailyCandle>;
  return [candle.time, candle.open, candle.high, candle.low, candle.close]
    .every((v) => typeof v === "number" && Number.isFinite(v) && v > 0)
    && Number(candle.high) >= Math.max(Number(candle.open), Number(candle.close), Number(candle.low))
    && Number(candle.low) <= Math.min(Number(candle.open), Number(candle.close), Number(candle.high));
}

function PlainCandleChart({
  candles,
  highLine,
  lowLine,
}: {
  candles: DailyCandle[];
  highLine: number | null;
  lowLine: number | null;
}) {
  const shown = candles.slice(-30);
  const w = 570, h = 260, left = 52, right = 22, top = 30, bottom = 32;
  const maxPrice = Math.max(...shown.map((c) => c.high), highLine ?? 0);
  const minPrice = Math.min(...shown.map((c) => c.low), lowLine ?? Infinity);
  const margin = Math.max((maxPrice - minPrice) * 0.09, maxPrice * 0.003, 0.01);
  const maximum = maxPrice + margin, minimum = Math.max(0, minPrice - margin);
  const y = (price: number) => top + (maximum - price) / Math.max(0.01, maximum - minimum) * (h - top - bottom);
  const x = (index: number) => left + ((index + 0.5) / shown.length) * (w - left - right);
  const step = (w - left - right) / shown.length;
  const lowestIndex = shown.findIndex((c) => c.low === Math.min(...shown.map((bar) => bar.low)));
  const lastIndex = shown.length - 1;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} role="img"
      aria-label="実際の確定日足のローソク足。青丸は表示期間の最安値、紫丸は最後の確定足。青い破線は直前20本の安値、橙色の破線は直前20本の高値。"
      className="block h-auto w-full rounded-lg bg-white">
      {[0, 1, 2, 3, 4].map((index) => {
        const price = maximum - (maximum - minimum) * index / 4;
        return <g key={index}>
          <line x1={left} x2={w - right} y1={y(price)} y2={y(price)} stroke="#e2e8f0" />
          <text x={left - 5} y={y(price) + 4} fontSize="11" textAnchor="end" fill="#475569">
            {Math.round(price).toLocaleString("ja-JP")}
          </text>
        </g>;
      })}
      {highLine != null && (
        <g>
          <line x1={left} x2={w - right} y1={y(highLine)} y2={y(highLine)}
            stroke="#d97706" strokeDasharray="6 4" strokeWidth="1.8" />
          <text x={w - right - 3} y={Math.max(16, y(highLine) - 5)}
            fontSize="11" fontWeight="bold" textAnchor="end" fill="#92400e">前20本の高値</text>
        </g>
      )}
      {lowLine != null && (
        <g>
          <line x1={left} x2={w - right} y1={y(lowLine)} y2={y(lowLine)}
            stroke="#2563eb" strokeDasharray="6 4" strokeWidth="1.8" />
          <text x={w - right - 3} y={Math.min(h - 32, y(lowLine) + 14)}
            fontSize="11" fontWeight="bold" textAnchor="end" fill="#1d4ed8">前20本の安値</text>
        </g>
      )}
      {shown.map((candle, index) => {
        const cx = x(index);
        const color = candle.close >= candle.open ? "#059669" : "#dc2626";
        const upper = Math.min(y(candle.open), y(candle.close));
        const height = Math.max(1.8, Math.abs(y(candle.open) - y(candle.close)));
        return <g key={candle.time}>
          <line x1={cx} x2={cx} y1={y(candle.high)} y2={y(candle.low)}
            stroke={color} strokeWidth="2" />
          <rect x={cx - Math.min(step * 0.28, 7)} y={upper}
            width={Math.min(step * 0.56, 14)} height={height} fill={color} />
          {index === lowestIndex && (
            <circle cx={cx} cy={y(candle.low) + 3} r="7.5"
              fill="white" fillOpacity="0.75" stroke="#2563eb" strokeWidth="2.5" />
          )}
          {index === lastIndex && (
            <circle cx={cx} cy={y(candle.close)} r="7.5"
              fill="white" fillOpacity="0.75" stroke="#7c3aed" strokeWidth="2.5" />
          )}
          {(index === 0 || index === lastIndex || index % 10 === 0) && (
            <text x={cx} y={h - 11} fontSize="11" textAnchor="middle" fill="#475569">
              {jstDate(candle.time).slice(5)}
            </text>
          )}
        </g>;
      })}
    </svg>
  );
}

/**
 * Educational only. Draws actual completed daily OHLC from the existing chart
 * endpoint; never substitutes a synthetic chart or an entry/exit signal.
 */
export default function AnalysisVisualGuide({
  code,
  analysisPrice,
}: {
  code: string;
  analysisPrice: number | null;
}) {
  const [chart, setChart] = useState<ChartState>({ kind: "loading" });

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      setChart({ kind: "loading" });
      try {
        const response = await fetch("/api/chart/" + encodeURIComponent(code) + "?tf=1D", {
          cache: "no-store", signal: controller.signal,
        });
        if (!response.ok) throw new Error("no response");
        const payload = (await response.json()) as ChartResponse;
        if (!payload.success || !Array.isArray(payload.candles)) throw new Error("no candles");
        const now = new Date();
        const candles = payload.candles
          .filter(validCandle)
          .filter((candle) => isCompletedDay(candle.time, now))
          .sort((a, b) => a.time - b.time)
          .filter((candle, index, array) => index === 0 || candle.time !== array[index - 1].time);
        if (candles.length < 22) throw new Error("insufficient candles");
        if (!controller.signal.aborted) setChart({
          kind: "ready", candles, stale: payload.status === "stale",
        });
      } catch {
        if (!controller.signal.aborted) setChart({ kind: "unavailable" });
      }
    }
    if (/^[0-9A-Za-z]{4,5}$/.test(code)) void load();
    else setChart({ kind: "unavailable" });
    return () => controller.abort();
  }, [code]);

  const candles = chart.kind === "ready" ? chart.candles : [];
  const latest = candles.at(-1);
  const prior = candles.slice(-21, -1);
  const highLine = prior.length === 20 ? Math.max(...prior.map((bar) => bar.high)) : null;
  const lowLine = prior.length === 20 ? Math.min(...prior.map((bar) => bar.low)) : null;
  const validPrice = analysisPrice != null && Number.isFinite(analysisPrice) && analysisPrice > 0;
  const avgVolume = prior.length === 20 && prior.every((bar) => Number.isFinite(bar.volume) && Number(bar.volume) > 0)
    ? prior.reduce((sum, bar) => sum + Number(bar.volume), 0) / prior.length : null;
  const volumeRatio = avgVolume && latest && Number.isFinite(latest.volume) && Number(latest.volume) > 0
    ? Number(latest.volume) / avgVolume : null;
  const dayOld = latest ? (Date.now() - latest.time * 1000) > 8 * 86_400_000 : true;
  const insufficient = !validPrice || chart.kind !== "ready" || chart.stale || dayOld;

  const observed = !latest || highLine == null || lowLine == null ? "日足データを確認できません"
    : latest.close > highLine ? "参考終値は直前20本の高値より上です"
    : latest.close < lowLine ? "参考終値は直前20本の安値より下です"
    : "参考終値は直前20本の高値・安値の間です";

  return (
    <section className="mt-2 rounded-2xl border border-blue-200 bg-white p-3 shadow-sm dark:border-blue-900 dark:bg-slate-900"
      aria-label="この銘柄のチャートの見方">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h2 className="text-base font-black text-slate-950 dark:text-white">📊 チャートと目印で確認</h2>
        <span className="rounded-full bg-slate-100 px-2 py-1 text-[11px] font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
          確定日足・参考
        </span>
      </div>
      <p className="mt-1 text-xs leading-5 text-slate-600 dark:text-slate-300">
        実際に取得した日足だけを表示します。最新の確定日：{latest ? jstDate(latest.time) : "取得待ち"}。
        目印は観察ポイントであり、買い・売りの発生位置ではありません。
      </p>
      {chart.kind === "loading" ? (
        <p role="status" className="mt-3 rounded-lg bg-slate-50 p-4 text-sm dark:bg-slate-800">確定日足を確認しています…</p>
      ) : chart.kind === "unavailable" ? (
        <p role="status" className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm font-bold text-amber-900 dark:bg-amber-950/20 dark:text-amber-200">
          参考日足が不足・取得失敗のため、目印は表示しません。実際のローソク足を確認してください。
        </p>
      ) : (
        <>
          <div className="mt-3 rounded-xl border border-slate-100 bg-white p-1">
            <PlainCandleChart candles={candles} highLine={highLine} lowLine={lowLine} />
          </div>
          <div className="mt-2 grid grid-cols-1 gap-1 text-xs leading-5 text-slate-700 dark:text-slate-200 min-[440px]:grid-cols-2">
            <p><strong className="text-blue-700 dark:text-blue-300">◯ 青丸：</strong>表示期間で最も安かった足（底確定ではない）</p>
            <p><strong className="text-violet-700 dark:text-violet-300">◯ 紫丸：</strong>最後の確定足（売買サインではない）</p>
            <p><strong className="text-amber-700 dark:text-amber-300">┄ オレンジ：</strong>直前20本の高値 {highLine != null ? yen(highLine) : "未取得"}</p>
            <p><strong className="text-blue-700 dark:text-blue-300">┄ 青点線：</strong>直前20本の安値 {lowLine != null ? yen(lowLine) : "未取得"}</p>
          </div>
        </>
      )}
      <div className="mt-3 rounded-xl bg-emerald-50 p-3 dark:bg-emerald-950/20">
        <h3 className="text-sm font-black text-emerald-900 dark:text-emerald-200">📊 チャートから分かること</h3>
        <p className="mt-1 text-sm font-bold leading-6 text-slate-900 dark:text-white">
          {insufficient ? "参考データの確認が必要です" : observed}
        </p>
        {insufficient && (
          <p className="mt-1 text-xs leading-5 text-slate-700 dark:text-slate-300">
            株価・確定日足の新しさなどを確認できないため、ここから新しい買い判断はしません。
          </p>
        )}
        <p className="mt-1 text-[11px] leading-5 text-slate-600 dark:text-slate-400">
          この図は過去の価格の観察用です。上の高値・安値は簡単な比較線であり、支持線・抵抗線の確定や売買推奨ではありません。
          新規購入のタイミングについては、この下の「スイング判定」で確認してください。
        </p>
      </div>
      <div className="mt-2 rounded-xl bg-blue-50 p-3 dark:bg-blue-950/20">
        <h3 className="text-sm font-black text-blue-900 dark:text-blue-200">🚩 次に見るポイント</h3>
        <ol className="mt-2 space-y-1.5 text-xs font-medium leading-5 text-slate-800 dark:text-slate-200">
          <li>① 直前20本の高値 {highLine != null ? yen(highLine) : "（未取得）"} を終値で超えられるか</li>
          <li>② 出来高が続くか {volumeRatio == null ? "（比較データ不足）" : "（確定日足の前20本平均比 " + volumeRatio.toFixed(2) + "倍）"}</li>
          <li>③ 直前20本の安値 {lowLine != null ? yen(lowLine) : "（未取得）"} を割り込まないか</li>
        </ol>
        <p className="mt-2 text-[11px] leading-5 text-slate-600 dark:text-slate-300">
          9:05以降の5分足や最新の株価・ニュースは別途確認してください。この日足図だけで売買を決めません。
        </p>
      </div>
      <div className="mt-3 rounded-xl border border-violet-200 bg-violet-50 p-3">
        <p className="text-sm font-black text-violet-900">📚 チャートの形を図鑑で確認</p>
        <p className="mt-1 text-xs leading-5 text-slate-700">
          このチャートの青丸は表示期間の最安値で、ダブルボトムの「底①・底②」を自動認定したものではありません。
          図鑑の目印と見比べて、形が完成しているか学べます。
        </p>
        <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
          <Link href={`/learning/patterns/pattern002?code=${encodeURIComponent(code)}`}
            className="flex min-h-11 items-center justify-center rounded-lg border border-violet-300 bg-white px-3 text-center text-xs font-black text-violet-800">
            🔵 底①・底②・ネックラインの見方
          </Link>
          <Link href="/learning/chart-quiz"
            className="flex min-h-11 items-center justify-center rounded-lg border border-violet-300 bg-white px-3 text-center text-xs font-black text-violet-800">
            🧠 3択クイズで練習
          </Link>
        </div>
      </div>
      <Link href={`/chart/${encodeURIComponent(code)}`}
        className="mt-3 flex min-h-11 items-center justify-center rounded-xl bg-blue-600 px-3 text-sm font-black text-white">
        ローソク足チャートを詳しく見る →
      </Link>
    </section>
  );
}
