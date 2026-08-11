"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  normalizeScanDetectedPatterns,
  type ScanDetectedPattern,
} from "@/app/components/scan/DetectedPatternSummary";
import BollingerSignalCard from "@/app/components/bollinger/BollingerSignalCard";
import type { BollingerSignal } from "@/app/lib/bollingerBands";
import { isVisibleBollingerSignal } from "@/app/lib/bollingerPresentation";

type ApiStock = {
  code?: string | number;
  name?: string;
  price?: number;
  currentPrice?: number;
  score?: number;
  aiPower?: number;
  changePercent?: number;
  rsi?: number;
  volumeRatio?: number;
  reason?: string;
  patternSignal?: string;
  signal?: string;
  notificationLevel?: string;
  takeProfit?: number | string;
  stopLoss?: number | string;
  detectedPatterns?: unknown;
  bollinger?: BollingerSignal;
};

type Stock = {
  code: string;
  name: string;
  price: number;
  changePercent: number;
  rsi: number;
  volumeRatio: number;
  score: number;
  reason: string;
  patternSignal: string;
  notificationLevel: string;
  takeProfit?: number;
  stopLoss?: number;
  detectedPatterns: ScanDetectedPattern[];
  bollinger?: BollingerSignal;
};

type ScanResponse = {
  success?: boolean;
  totalStockList?: number;
  scannedCount?: number;
  stocks?: ApiStock[];
};

const REFRESH_MS = 60_000;
const FETCH_TIMEOUT_MS = 30_000;

function finiteNumber(value: unknown, fallback = 0) {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : fallback;
}

function optionalNumber(value: unknown) {
  if (value === null || value === undefined || value === "") return undefined;
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : undefined;
}

function normalizeStocks(input: ApiStock[]): Stock[] {
  return input
    .map((stock) => ({
      code: String(stock.code ?? "").trim(),
      name: String(stock.name ?? "名称不明"),
      price: finiteNumber(stock.price ?? stock.currentPrice),
      changePercent: finiteNumber(stock.changePercent),
      rsi: finiteNumber(stock.rsi),
      volumeRatio: finiteNumber(stock.volumeRatio),
      score: finiteNumber(stock.score ?? stock.aiPower),
      reason: String(stock.reason ?? ""),
      patternSignal: String(stock.patternSignal ?? stock.signal ?? "NONE"),
      notificationLevel: String(stock.notificationLevel ?? ""),
      takeProfit: optionalNumber(stock.takeProfit),
      stopLoss: optionalNumber(stock.stopLoss),
      detectedPatterns: normalizeScanDetectedPatterns(stock.detectedPatterns),
      bollinger: stock.bollinger,
    }))
    .filter((stock) => stock.code)
    .sort((a, b) => b.score - a.score);
}

function getSignal(score: number) {
  if (score >= 95) return "大本命";
  if (score >= 85) return "激熱";
  if (score >= 70) return "買い候補";
  if (score >= 50) return "静観";
  return "見送り";
}

function getRank(score: number) {
  if (score >= 95) return "S";
  if (score >= 85) return "A";
  if (score >= 70) return "B";
  if (score >= 50) return "C";
  return "D";
}

function reasonItems(stock: Stock) {
  const patternNames = stock.detectedPatterns.map((pattern) => pattern.name);
  const reasons = stock.reason
    .split(/[｜|、,，。\n・]+/)
    .map((item) => item.trim().replace(/^[✓✔︎✅\-・\s]+/, ""))
    .filter(Boolean);
  return Array.from(new Set([...patternNames, ...reasons]));
}

function yen(value?: number) {
  return typeof value === "number" && Number.isFinite(value)
    ? `${Math.round(value).toLocaleString()}円`
    : "—";
}

function riskReward(stock: Stock) {
  if (
    typeof stock.takeProfit !== "number" ||
    typeof stock.stopLoss !== "number" ||
    stock.price <= stock.stopLoss
  ) return "—";
  return ((stock.takeProfit - stock.price) / (stock.price - stock.stopLoss)).toFixed(1);
}

export default function ScanPage() {
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorText, setErrorText] = useState("");
  const [totalStockList, setTotalStockList] = useState(0);
  const [scannedCount, setScannedCount] = useState(0);
  const [alerts, setAlerts] = useState<string[]>([]);

  const fetchStocks = useCallback(async () => {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      setErrorText("");
      const res = await fetch("/api/scan?limit=100&top=100", {
        cache: "no-store",
        signal: controller.signal,
      });
      if (!res.ok) throw new Error(`scan api error: ${res.status}`);
      const data: ScanResponse | ApiStock[] = await res.json();
      const rawStocks = Array.isArray(data) ? data : Array.isArray(data.stocks) ? data.stocks : [];
      const normalized = normalizeStocks(rawStocks);
      setStocks(normalized);
      setTotalStockList(Array.isArray(data) ? normalized.length : Number(data.totalStockList ?? normalized.length));
      setScannedCount(Array.isArray(data) ? normalized.length : Number(data.scannedCount ?? normalized.length));
      const newAlerts = normalized
        .filter((stock) => stock.score >= 95)
        .map((stock) => `${new Date().toLocaleTimeString("ja-JP")} ${stock.code} ${stock.name} AI ${stock.score}`);
      if (newAlerts.length) setAlerts((previous) => [...newAlerts, ...previous].slice(0, 10));
    } catch (error) {
      setErrorText(
        error instanceof Error && error.name === "AbortError"
          ? "スキャンAPIがタイムアウトしました。少し待って再読み込みしてください。"
          : "スキャンデータを取得できませんでした。",
      );
      console.error("scan fetch error:", error);
    } finally {
      window.clearTimeout(timeoutId);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 初回表示時に既存のScan取得処理を開始するため。
    void fetchStocks();
    const intervalId = window.setInterval(() => void fetchStocks(), REFRESH_MS);
    return () => window.clearInterval(intervalId);
  }, [fetchStocks]);

  const stats = useMemo(() => {
    const hot = stocks.filter((stock) => stock.score >= 85).length;
    const strong = stocks.filter((stock) => stock.score >= 70 && stock.score < 85).length;
    const average = stocks.length
      ? Math.round(stocks.reduce((sum, stock) => sum + stock.score, 0) / stocks.length)
      : 0;
    return { hot, strong, average };
  }, [stocks]);

  const topStock = stocks[0];
  const additionalBollingerStocks = stocks
    .slice(1)
    .filter((stock) => isVisibleBollingerSignal(stock.bollinger))
    .slice(0, 2);

  return (
    <main className="min-h-screen bg-[#f7f8fa] pb-24 text-slate-950">
      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 md:py-10">
        <header className="mb-8 flex items-start justify-between gap-4">
          <div>
            <Link href="/dashboard" className="mb-4 inline-flex items-center gap-1 text-sm font-bold text-slate-500 transition hover:text-slate-900">
              <span aria-hidden>←</span> Dashboard
            </Link>
            <p className="text-xs font-black tracking-[0.22em] text-blue-600">AI STOCK SCAN</p>
            <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">今日の買い候補</h1>
            <p className="mt-2 text-sm leading-6 text-slate-500">AIが全銘柄を分析し、有力候補をランキング表示します。</p>
          </div>
          <button type="button" onClick={() => void fetchStocks()} className="mt-8 min-h-11 shrink-0 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 shadow-sm transition hover:border-slate-300 hover:shadow-md">
            ↻ 再読み込み
          </button>
        </header>

        <section className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-5" aria-label="スキャン状況">
          <Stat label="監視対象" value={totalStockList} />
          <Stat label="取得済み" value={scannedCount} />
          <Stat label="激熱候補" value={stats.hot} />
          <Stat label="買い候補" value={stats.strong} />
          <Stat label="平均AI" value={stats.average} />
        </section>

        {loading && <LoadingCard />}
        {!loading && errorText && (
          <div className="rounded-[28px] border border-red-200 bg-red-50 p-6 text-sm font-bold text-red-700">{errorText}</div>
        )}

        {!loading && topStock && <TopPickCard stock={topStock} />}

        {!loading && stocks.length > 1 && (
          <section className="mt-4 grid gap-3 sm:grid-cols-2" aria-label="上位候補">
            {stocks.slice(1, 3).map((stock, index) => <PodiumStockCard key={stock.code} stock={stock} rank={index + 2} />)}
          </section>
        )}

        {!loading && additionalBollingerStocks.length > 0 && (
          <section className="mt-6" aria-labelledby="bb-signal-title">
            <div className="mb-3">
              <p className="text-xs font-black tracking-[0.18em] text-emerald-600">DAILY BOLLINGER BAND</p>
              <h2 id="bb-signal-title" className="mt-1 text-lg font-black">日足BBの注目シグナル</h2>
              <p className="mt-1 text-xs text-slate-500">AI POWERとは別の補助情報です。</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {additionalBollingerStocks.map((stock) => (
                <Link key={stock.code} href={`/analysis/${stock.code}`} className="min-w-0 rounded-[24px] border border-slate-200 bg-white p-3 shadow-sm transition hover:border-slate-300 hover:shadow-md">
                  <div className="mb-2 flex min-w-0 items-baseline justify-between gap-2 px-1">
                    <p className="truncate text-sm font-black text-slate-900">{stock.name}</p>
                    <p className="shrink-0 text-xs font-bold text-slate-500">{stock.code}</p>
                  </div>
                  <BollingerSignalCard signal={stock.bollinger} variant="compact" />
                </Link>
              ))}
            </div>
          </section>
        )}

        {!loading && !topStock && (
          <EmptyTopPickCard onRetry={() => void fetchStocks()} />
        )}

        {!loading && stocks.length > 0 && (
          <section className="mt-10">
            <div className="mb-4 flex items-end justify-between gap-3">
              <div>
                <p className="text-xs font-black tracking-[0.18em] text-blue-600">RANKING</p>
                <h2 className="mt-1 text-2xl font-black tracking-tight">今日のTOP10</h2>
              </div>
              <p className="text-xs font-medium text-slate-400">銘柄をタップして詳細へ</p>
            </div>
            <div className="overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-[0_8px_30px_rgba(15,23,42,0.05)]">
              <div className="grid grid-cols-[44px_72px_minmax(0,1fr)_68px_82px_22px] items-center gap-2 border-b border-slate-100 bg-slate-50 px-3 py-3 text-[10px] font-black tracking-wider text-slate-400 sm:grid-cols-[56px_90px_minmax(0,1fr)_90px_110px_24px] sm:px-5">
                <span>順位</span><span>コード</span><span>銘柄名</span><span className="text-right">AI評価</span><span className="text-right">株価</span><span />
              </div>
              <div className="divide-y divide-slate-100">
                {stocks.slice(3, 10).map((stock, index) => (
                  <Link key={stock.code} href={`/analysis/${stock.code}`} className="group grid min-h-16 grid-cols-[44px_72px_minmax(0,1fr)_68px_82px_22px] items-center gap-2 px-3 py-3 transition hover:bg-blue-50/60 focus-visible:bg-blue-50 sm:grid-cols-[56px_90px_minmax(0,1fr)_90px_110px_24px] sm:px-5">
                    <span className="text-sm font-black text-slate-400">{index + 4}</span>
                    <span className="text-xs font-bold text-slate-500 sm:text-sm">{stock.code}</span>
                    <span className="truncate text-sm font-black text-slate-900">{stock.name}</span>
                    <span className="text-right text-lg font-black text-blue-600">{Math.round(stock.score)}</span>
                    <span className="text-right text-sm font-bold tabular-nums text-slate-700">{yen(stock.price)}</span>
                    <span className="text-lg text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-blue-500" aria-hidden>›</span>
                  </Link>
                ))}
              </div>
            </div>
          </section>
        )}

        {alerts.length > 0 && (
          <details className="mt-6 rounded-2xl border border-slate-200 bg-white px-5 py-4 text-sm">
            <summary className="cursor-pointer font-bold text-slate-700">シグナルアラート（{alerts.length}件）</summary>
            <div className="mt-3 space-y-2 text-slate-500">{alerts.map((alert, index) => <p key={`${alert}-${index}`}>{alert}</p>)}</div>
          </details>
        )}
      </div>
    </main>
  );
}

function TopPickCard({ stock }: { stock: Stock }) {
  const reasons = reasonItems(stock);
  const stars = Math.max(1, Math.min(5, Math.ceil(stock.score / 20)));
  return (
    <article data-testid="scan-top-pick" className="relative mt-4 overflow-hidden rounded-[32px] border border-amber-300 bg-[linear-gradient(145deg,#fffdf7_0%,#ffffff_46%,#fff8df_100%)] p-5 shadow-[0_24px_70px_rgba(180,125,20,0.18)] sm:p-8 md:p-10">
      <div className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full bg-amber-200/30 blur-3xl" />
      <div className="relative">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div className="flex min-w-0 items-center gap-4">
            <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-amber-200 to-amber-500 text-4xl shadow-[0_10px_25px_rgba(217,154,22,0.3)]" aria-label="1位ゴールドメダル">🥇</span>
            <div className="min-w-0">
              <div className="inline-flex rounded-full bg-amber-100 px-3 py-1 text-[11px] font-black tracking-[0.16em] text-amber-800">本日の最有力候補</div>
              <h2 className="mt-2 truncate text-2xl font-black tracking-tight sm:text-3xl">{stock.name}</h2>
              <p className="mt-1 text-sm font-bold text-slate-500">{stock.code} ・ 現在値 {yen(stock.price)}</p>
            </div>
          </div>
          <div className="min-w-[160px] text-left sm:text-right">
            <p className="text-[11px] font-black tracking-[0.2em] text-amber-700">AI EVALUATION</p>
            <p data-testid="scan-ai-evaluation" className="mt-1 text-6xl font-black leading-none tracking-[-0.07em] text-slate-950 sm:text-7xl">{Math.round(stock.score)}<span className="ml-2 text-lg tracking-normal text-slate-400">/100</span></p>
            <div className="mt-3 flex items-center gap-2 sm:justify-end">
              <span className="text-lg tracking-widest text-amber-500" aria-label={`5段階中${stars}`}>{"★".repeat(stars)}<span className="text-slate-200">{"★".repeat(5 - stars)}</span></span>
              <span data-testid="scan-rank" className="rounded-lg bg-slate-950 px-2.5 py-1 text-xs font-black text-white">{getRank(stock.score)}ランク</span>
            </div>
          </div>
        </div>

        <div data-testid="scan-ai-power" className="mt-7">
          <div className="flex items-center justify-between text-xs font-black"><span className="tracking-[0.16em] text-slate-500">AI POWER</span><span className="text-amber-700">{getSignal(stock.score)}</span></div>
          <div className="mt-2 h-3 overflow-hidden rounded-full bg-amber-100"><div className="h-full rounded-full bg-gradient-to-r from-amber-400 via-yellow-500 to-amber-600 shadow-[0_0_14px_rgba(217,154,22,0.5)]" style={{ width: `${Math.min(Math.max(stock.score, 0), 100)}%` }} /></div>
        </div>

        <BollingerSignalCard signal={stock.bollinger} variant="compact" className="mt-5" />

        <div className="mt-7 grid gap-6 lg:grid-cols-[minmax(0,1.25fr)_minmax(320px,0.75fr)]">
          <div className="rounded-[24px] border border-amber-200/80 bg-white/80 p-5 shadow-sm backdrop-blur">
            <h3 className="text-sm font-black text-slate-900">AIが注目した理由</h3>
            {reasons.length ? (
              <>
                <ul className="mt-3 space-y-2.5">{reasons.slice(0, 3).map((reason) => <li key={reason} className="flex gap-2 text-sm font-bold leading-6 text-slate-700"><span className="text-emerald-600">✓</span><span>{reason}</span></li>)}</ul>
                {reasons.length > 3 && <details className="group mt-3"><summary className="cursor-pointer text-sm font-black text-blue-600">もっと見る ↓</summary><ul className="mt-3 space-y-2 border-t border-slate-100 pt-3">{reasons.slice(3).map((reason) => <li key={reason} className="flex gap-2 text-sm leading-6 text-slate-600"><span className="text-emerald-600">✓</span><span>{reason}</span></li>)}</ul></details>}
              </>
            ) : <p className="mt-3 text-sm text-slate-400">AI理由の詳細はありません</p>}
          </div>

          <div data-testid="scan-trade-metrics" className="grid grid-cols-3 gap-2.5">
            <MetricCard icon="↗" label="利確" value={yen(stock.takeProfit)} tone="emerald" />
            <MetricCard icon="↘" label="損切" value={yen(stock.stopLoss)} tone="red" />
            <MetricCard icon="⚖" label="RR比" value={riskReward(stock)} tone="blue" />
          </div>
        </div>

        <Link href={`/analysis/${stock.code}`} className="mt-7 flex min-h-14 w-full items-center justify-center rounded-2xl bg-slate-950 px-6 text-sm font-black text-white shadow-lg transition hover:-translate-y-0.5 hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600">
          {stock.name} のAI分析を見る <span className="ml-2 text-lg">→</span>
        </Link>
      </div>
    </article>
  );
}

function PodiumStockCard({ stock, rank }: { stock: Stock; rank: number }) {
  const isSecond = rank === 2;
  return (
    <Link href={`/analysis/${stock.code}`} className={`group flex items-center gap-4 rounded-[24px] border p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${isSecond ? "border-slate-300 bg-gradient-to-br from-slate-50 to-white" : "border-orange-200 bg-gradient-to-br from-orange-50 to-white"}`}>
      <span className={`grid h-14 w-14 shrink-0 place-items-center rounded-full text-3xl shadow-inner ${isSecond ? "bg-gradient-to-br from-slate-200 to-slate-400" : "bg-gradient-to-br from-orange-200 to-orange-500"}`} aria-label={`${rank}位メダル`}>{isSecond ? "🥈" : "🥉"}</span>
      <div className="min-w-0 flex-1"><p className={`text-xs font-black tracking-[0.14em] ${isSecond ? "text-slate-600" : "text-orange-700"}`}>第{rank}位</p><h3 className="mt-1 truncate text-xl font-black">{stock.name}</h3><p className="mt-1 text-xs font-bold text-slate-500">{stock.code} ・ {yen(stock.price)}</p></div>
      <div className="text-right"><p className="text-[10px] font-black text-slate-400">AI評価</p><p className="text-3xl font-black text-blue-600">{Math.round(stock.score)}</p></div>
    </Link>
  );
}

function EmptyTopPickCard({ onRetry }: { onRetry: () => void }) {
  return (
    <article data-testid="scan-top-pick-empty" className="mt-4 rounded-[32px] border border-amber-300 bg-[linear-gradient(145deg,#fffdf7_0%,#ffffff_55%,#fff8df_100%)] p-6 shadow-[0_20px_60px_rgba(180,125,20,0.14)] sm:p-8">
      <p className="text-xs font-black tracking-[0.16em] text-amber-800">♛ 本日の最有力候補</p>
      <h2 className="mt-3 text-2xl font-black text-slate-950">スキャン結果を取得できませんでした</h2>
      <p className="mt-2 text-sm leading-6 text-slate-600">候補データが届き次第、AI POWER・星評価・ランク・AI理由・利確・損切・R:Rをここに表示します。</p>
      <button type="button" onClick={onRetry} className="mt-5 min-h-11 rounded-xl bg-slate-950 px-5 text-sm font-black text-white transition hover:bg-blue-700">再取得する</button>
    </article>
  );
}

function MetricCard({ icon, label, value, tone }: { icon: string; label: string; value: string; tone: "emerald" | "red" | "blue" }) {
  const tones = { emerald: "bg-emerald-50 text-emerald-700", red: "bg-red-50 text-red-700", blue: "bg-blue-50 text-blue-700" };
  return <div className={`flex min-h-28 flex-col items-center justify-center rounded-[20px] px-2 text-center ${tones[tone]}`}><span className="text-xl" aria-hidden>{icon}</span><span className="mt-1 text-[11px] font-black">{label}</span><span className="mt-2 text-base font-black tabular-nums sm:text-lg">{value}</span></div>;
}

function Stat({ label, value }: { label: string; value: number }) {
  return <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm"><p className="text-[10px] font-black tracking-wide text-slate-400">{label}</p><p className="mt-1 text-xl font-black tabular-nums text-slate-800">{value.toLocaleString()}</p></div>;
}

function LoadingCard() {
  return <div className="rounded-[32px] border border-slate-200 bg-white p-10 text-center shadow-sm"><div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-blue-100 border-t-blue-600" /><p className="mt-4 text-sm font-bold text-slate-500">AIランキングを読み込み中...</p></div>;
}
