"use client";

import Link from "next/link";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import BottomNav from "@/app/components/BottomNav";
import type { ScanDetectedPattern } from "@/app/components/scan/DetectedPatternSummary";

type Stock = {
  code: string;
  name: string;
  score: number;
  price: number;
  changePercent: number;
  rsi: number;
  volumeRatio: number;
  reason: string;
  takeProfit?: number;
  stopLoss?: number;
  trend?: string;
  patternSignal?: string;
  patternScore?: number;
  detectedPatterns?: ScanDetectedPattern[];
};

type SignalFilter = "hot" | "strong" | "market-hot" | "market-watch" | "all";
type BudgetFilter = 10000 | 100000 | 300000 | 500000 | 1000000 | "all";
type SortMode = "score" | "change" | "down" | "cheap" | "expensive" | "money";
type FetchError = "api" | "timeout" | null;

const budgetOptions: { label: string; value: BudgetFilter }[] = [
  { label: "1万円以内", value: 10000 },
  { label: "10万円以内", value: 100000 },
  { label: "30万円以内", value: 300000 },
  { label: "50万円以内", value: 500000 },
  { label: "100万円以内", value: 1000000 },
  { label: "制限なし", value: "all" },
];

const sortOptions: { label: string; value: SortMode }[] = [
  { label: "AI評価順", value: "score" },
  { label: "上昇率順", value: "change" },
  { label: "下落率順", value: "down" },
  { label: "株価が安い順", value: "cheap" },
  { label: "株価が高い順", value: "expensive" },
  { label: "必要資金順", value: "money" },
];

const HOT_TOP_LIMIT = 3;
const STRONG_TOP_LIMIT = 10;

function yen(value?: number | null) {
  if (value === undefined || value === null || !Number.isFinite(value)) return "—";
  return `${Math.round(value).toLocaleString()}円`;
}

function scoreText(value?: number | null) {
  if (value === undefined || value === null || !Number.isFinite(value)) return "—";
  return Number.isInteger(value) ? value.toFixed(0) : value.toFixed(1);
}

function getRank(score: number) {
  if (score >= 95) return "S";
  if (score >= 85) return "A";
  if (score >= 70) return "B";
  if (score >= 50) return "C";
  return "D";
}

function getSignal(score: number) {
  if (score >= 95) return "大本命";
  if (score >= 85) return "激熱";
  if (score >= 70) return "買い候補";
  if (score >= 50) return "静観";
  return "見送り";
}

function reasonItems(stock: Stock) {
  const patternNames = (stock.detectedPatterns ?? []).map((pattern) => pattern.name);
  const reasons = stock.reason
    .split(/[｜|、,，。\n・]+/)
    .map((item) => item.trim().replace(/^[✓✔︎✅\-・\s]+/, ""))
    .filter(Boolean);
  return Array.from(new Set([...patternNames, ...reasons]));
}

function riskReward(stock: Stock) {
  if (
    !Number.isFinite(stock.price) ||
    !Number.isFinite(stock.takeProfit) ||
    !Number.isFinite(stock.stopLoss) ||
    stock.takeProfit === undefined ||
    stock.stopLoss === undefined ||
    stock.price <= stock.stopLoss
  ) return "—";
  const ratio = (stock.takeProfit - stock.price) / (stock.price - stock.stopLoss);
  return Number.isFinite(ratio) ? ratio.toFixed(1) : "—";
}

function budgetLabel(value: BudgetFilter) {
  if (value === "all") return "予算制限なし";
  return `${Math.round(value / 10000)}万円以内`;
}

function signalLabel(filter: SignalFilter) {
  if (filter === "hot") return "今日の最有力";
  if (filter === "strong") return "買い候補";
  if (filter === "market-hot") return "市場の激熱候補";
  if (filter === "market-watch") return "市場の注目候補";
  return "すべての候補";
}

function sortLabel(sort: SortMode) {
  return sortOptions.find((option) => option.value === sort)?.label ?? "AI評価順";
}

function getMarketJudge(hot: number, strong: number) {
  if (hot >= 80) return { label: "超強気", risk: "高", strength: 92 };
  if (hot >= 30) return { label: "強気", risk: "中", strength: 78 };
  if (hot >= 10) return { label: "やや強気", risk: "中", strength: 65 };
  if (strong >= 30) return { label: "厳選", risk: "中", strength: 54 };
  return { label: "静観", risk: "低", strength: 38 };
}

function marketGuidance(
  market: ReturnType<typeof getMarketJudge>,
  candidateCount: number,
) {
  if (market.risk === "高") {
    return "無理に選ばず、様子見を優先してください";
  }
  if (candidateCount >= 5 && market.strength >= 65) {
    return "候補は多いですが、個別確認を優先してください";
  }
  if (candidateCount === 0) {
    return "条件に合う候補が出るまで、慎重に待ちましょう";
  }
  return "条件の良い候補だけを慎重に確認してください";
}

function getBestSignalMetrics(stock: Stock) {
  const { price, takeProfit, stopLoss } = stock;
  if (
    !Number.isFinite(price) ||
    !Number.isFinite(takeProfit) ||
    !Number.isFinite(stopLoss) ||
    price <= 0 ||
    takeProfit === undefined ||
    stopLoss === undefined ||
    takeProfit <= price ||
    stopLoss >= price
  ) return null;

  const expectedProfit = (takeProfit - price) * 100;
  const riskRewardRatio = (takeProfit - price) / (price - stopLoss);
  if (!Number.isFinite(expectedProfit) || !Number.isFinite(riskRewardRatio)) return null;
  return { stock, takeProfit, stopLoss, expectedProfit, riskRewardRatio };
}

function ScanLoading() {
  return (
    <main className="grid min-h-screen place-items-center bg-slate-50 px-5 text-slate-950 dark:bg-slate-950 dark:text-slate-100">
      <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-blue-100 border-t-blue-600 dark:border-slate-700 dark:border-t-blue-400" />
        <p className="mt-5 text-lg font-black">AIスキャンを準備しています</p>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">約1000銘柄から今日の候補を探しています。</p>
      </div>
    </main>
  );
}

export default function ScanMobilePage() {
  return (
    <Suspense fallback={<ScanLoading />}>
      <ScanMobileContent />
    </Suspense>
  );
}

function ScanMobileContent() {
  const searchParams = useSearchParams();
  const filterParam = searchParams.get("filter");
  const budgetParam = searchParams.get("budget");
  const initialSignalFilter: SignalFilter =
    filterParam === "market-hot" || filterParam === "market-watch" ? filterParam : "strong";
  const initialBudget: BudgetFilter =
    budgetParam === "all" ? "all" : ((Number(budgetParam) || 100000) as BudgetFilter);

  const [stocks, setStocks] = useState<Stock[]>([]);
  const [totalStocks, setTotalStocks] = useState(0);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [signalFilter, setSignalFilter] = useState<SignalFilter>(initialSignalFilter);
  const [budgetFilter, setBudgetFilter] = useState<BudgetFilter>(initialBudget);
  const [sortMode, setSortMode] = useState<SortMode>("score");
  const [showAll, setShowAll] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [fetchError, setFetchError] = useState<FetchError>(null);
  const rankingRef = useRef<HTMLElement>(null);
  const fetchingRef = useRef(false);

  const fetchStocks = useCallback(async () => {
    if (fetchingRef.current) return;
    fetchingRef.current = true;
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 90_000);

    try {
      setFetchError(null);
      if (stocks.length === 0) setLoading(true);
      const params = new URLSearchParams({ limit: "1200" });
      if (signalFilter === "market-hot" || signalFilter === "market-watch") {
        params.set("filter", signalFilter);
      } else {
        params.set("top", "100");
      }
      const response = await fetch(`/api/scan?${params.toString()}`, {
        cache: "no-store",
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(`scan api error: ${response.status}`);
      const json = await response.json();
      const list: Stock[] = Array.isArray(json)
        ? json
        : Array.isArray(json?.stocks)
          ? json.stocks
          : [];
      if (list.length === 0) throw new Error("scan api returned empty stocks");
      setStocks(list);
      setTotalStocks(Number(json?.totalStockList ?? list.length));
      setLastUpdated(new Date());
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        setFetchError("timeout");
        console.warn("scan-mobile fetch timeout");
      } else {
        setFetchError("api");
        console.error("scan-mobile fetch error:", error);
      }
    } finally {
      window.clearTimeout(timeoutId);
      fetchingRef.current = false;
      setLoading(false);
    }
  }, [signalFilter, stocks.length]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 初回表示時に既存のScan取得処理を開始するため。
    void fetchStocks();
    const timer = window.setInterval(() => void fetchStocks(), 60_000);
    return () => window.clearInterval(timer);
  }, [fetchStocks]);

  async function addFavorite(code: string, name: string) {
    try {
      await fetch("/api/favorites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, name }),
      });
      alert(`${name} をお気に入り登録しました`);
    } catch (error) {
      console.error(error);
    }
  }

  const rankedStocks = useMemo(
    () => [...stocks].sort((a, b) =>
      b.score - a.score ||
      b.changePercent - a.changePercent ||
      b.volumeRatio - a.volumeRatio ||
      a.code.localeCompare(b.code, "ja", { numeric: true }),
    ),
    [stocks],
  );
  const hotSignals = useMemo(() => rankedStocks.slice(0, HOT_TOP_LIMIT), [rankedStocks]);
  const strongSignals = useMemo(() => rankedStocks.slice(0, STRONG_TOP_LIMIT), [rankedStocks]);
  const hotSignalCodes = useMemo(() => new Set(hotSignals.map((stock) => stock.code)), [hotSignals]);
  const strongSignalCodes = useMemo(() => new Set(strongSignals.map((stock) => stock.code)), [strongSignals]);
  const rawHotCount = useMemo(() => stocks.filter((stock) => stock.score >= 95).length, [stocks]);
  const rawStrongCount = useMemo(() => stocks.filter((stock) => stock.score >= 85).length, [stocks]);

  const filteredStocks = useMemo(() => {
    const result = stocks.filter((stock) => {
      const signalOk = signalFilter === "hot"
        ? hotSignalCodes.has(stock.code)
        : signalFilter === "strong"
          ? strongSignalCodes.has(stock.code)
          : signalFilter === "market-hot"
            ? stock.score >= 75
            : signalFilter === "market-watch"
              ? stock.score >= 65 && stock.score < 75
              : true;
      return signalOk && (budgetFilter === "all" || stock.price * 100 <= budgetFilter);
    });
    if (sortMode === "score") result.sort((a, b) => b.score - a.score);
    if (sortMode === "change") result.sort((a, b) => b.changePercent - a.changePercent);
    if (sortMode === "down") result.sort((a, b) => a.changePercent - b.changePercent);
    if (sortMode === "cheap") result.sort((a, b) => a.price - b.price);
    if (sortMode === "expensive") result.sort((a, b) => b.price - a.price);
    if (sortMode === "money") result.sort((a, b) => a.price * 100 - b.price * 100);
    return result;
  }, [stocks, signalFilter, budgetFilter, sortMode, hotSignalCodes, strongSignalCodes]);

  const bestSignalMetrics = useMemo(() => {
    const candidates = filteredStocks
      .map(getBestSignalMetrics)
      .filter((candidate): candidate is NonNullable<ReturnType<typeof getBestSignalMetrics>> => candidate !== null)
      .sort((a, b) => b.stock.score - a.stock.score);
    return candidates.find(({ expectedProfit, riskRewardRatio }) => riskRewardRatio >= 1.2 && expectedProfit >= 500)
      ?? candidates.find(({ expectedProfit, riskRewardRatio }) => riskRewardRatio >= 1 && expectedProfit >= 300)
      ?? null;
  }, [filteredStocks]);

  const bestSignal = bestSignalMetrics?.stock ?? filteredStocks[0];
  const market = getMarketJudge(rawHotCount, rawStrongCount);
  const podiumStocks = bestSignal
    ? [bestSignal, ...filteredStocks.filter((stock) => stock.code !== bestSignal.code)].slice(0, 3)
    : [];
  const podiumCodes = new Set(podiumStocks.map((stock) => stock.code));
  const rankingStocks = filteredStocks.filter((stock) => !podiumCodes.has(stock.code));
  const visibleStocks = rankingStocks.slice(0, showAll ? 17 : 5);
  const candidateCount = strongSignals.length;

  const selectClass = "min-h-11 w-full appearance-none rounded-xl border border-slate-200 bg-slate-50 px-3 pr-8 text-xs font-bold text-slate-700 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:focus:ring-blue-900";

  return (
    <main className="min-h-screen overflow-x-hidden bg-slate-50 pb-28 text-slate-950 dark:bg-slate-950 dark:text-slate-100">
      <div className="mx-auto w-full max-w-5xl px-3 pb-10 pt-3 sm:px-6 lg:px-8">
        <header className="rounded-2xl bg-white px-3 py-2.5 dark:bg-slate-900 sm:px-4">
          <div className="flex items-center justify-between gap-3">
            <Link href="/dashboard" className="flex min-w-0 items-center gap-2" aria-label="SIGNALX ホーム">
              <span className="grid h-9 w-9 shrink-0 place-items-center text-3xl font-black italic text-blue-600 dark:text-blue-400" aria-hidden="true">X</span>
              <span className="min-w-0">
                <span className="block text-xl font-black leading-none tracking-tight">SIGNAL<span className="text-blue-600 dark:text-blue-400">X</span></span>
                <span className="mt-1 block text-[8px] font-black tracking-[0.2em] text-slate-500 dark:text-slate-400">AI STOCK SCAN</span>
              </span>
            </Link>
            <button type="button" onClick={() => void fetchStocks()} disabled={loading} className="inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-xs font-black text-slate-700 shadow-sm transition hover:border-blue-300 hover:text-blue-700 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
              <span className={loading ? "animate-spin" : ""} aria-hidden="true">↻</span> 更新
            </button>
          </div>
          <div className="mt-2 border-t border-slate-100 pt-2 dark:border-slate-800">
            <h1 className="text-xl font-black tracking-tight sm:text-2xl">AIスキャン</h1>
            <p className="mt-0.5 text-[11px] font-semibold leading-5 text-slate-500 dark:text-slate-400 sm:text-sm">AIが約1000銘柄を監視し、今日の買い候補を抽出</p>
          </div>
        </header>

        <ScanSummary
          total={totalStocks || stocks.length}
          fetched={stocks.length}
          candidates={candidateCount}
          updated={lastUpdated}
          market={market}
        />

        {fetchError && stocks.length > 0 && (
          <FetchWarning kind={fetchError} onRetry={() => void fetchStocks()} compact />
        )}

        {loading && stocks.length === 0 ? (
          <ScanLoadingCard />
        ) : fetchError && stocks.length === 0 ? (
          <FetchWarning kind={fetchError} onRetry={() => void fetchStocks()} />
        ) : bestSignal ? (
          <FeaturedStock stock={bestSignal} metrics={bestSignalMetrics} onFavorite={() => void addFavorite(bestSignal.code, bestSignal.name)} totalStocks={totalStocks || stocks.length} />
        ) : (
          <EmptyResult onChangeConditions={() => setFiltersOpen(true)} />
        )}

        {podiumStocks.length > 1 && (
          <section className="mt-3 grid gap-3 sm:grid-cols-2" aria-label="上位候補">
            {podiumStocks.slice(1).map((stock, index) => (
              <PodiumStockCard key={stock.code} stock={stock} rank={index + 2} />
            ))}
          </section>
        )}

        <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-700 dark:bg-slate-900 sm:p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[10px] font-black tracking-wide text-slate-500 dark:text-slate-400">現在の条件</p>
              <p className="mt-1 truncate text-xs font-bold text-slate-700 dark:text-slate-200 sm:text-sm">{signalLabel(signalFilter)}・{budgetLabel(budgetFilter)}・{sortLabel(sortMode)}</p>
            </div>
            <button type="button" aria-expanded={filtersOpen} onClick={() => setFiltersOpen((value) => !value)} className="min-h-10 shrink-0 rounded-xl border border-blue-200 bg-blue-50 px-3 text-xs font-black text-blue-700 transition hover:bg-blue-100 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-300">
              {filtersOpen ? "閉じる" : "条件を変更"}
            </button>
          </div>
          {filtersOpen && (
            <div className="mt-3 grid gap-3 border-t border-slate-100 pt-3 dark:border-slate-800 sm:grid-cols-3">
              <label className="block"><span className="mb-1.5 block text-[11px] font-bold text-slate-500 dark:text-slate-400">候補条件</span><select value={signalFilter} onChange={(event) => setSignalFilter(event.target.value as SignalFilter)} className={selectClass}><option value="strong">買い候補</option><option value="hot">今日の最有力</option><option value="all">すべて</option><option value="market-hot">市場の激熱候補</option><option value="market-watch">市場の注目候補</option></select></label>
              <label className="block"><span className="mb-1.5 block text-[11px] font-bold text-slate-500 dark:text-slate-400">必要資金</span><select value={budgetFilter} onChange={(event) => setBudgetFilter(event.target.value === "all" ? "all" : Number(event.target.value) as BudgetFilter)} className={selectClass}>{budgetOptions.map((option) => <option key={option.label} value={option.value}>{option.label}</option>)}</select></label>
              <label className="block"><span className="mb-1.5 block text-[11px] font-bold text-slate-500 dark:text-slate-400">並び順</span><select value={sortMode} onChange={(event) => setSortMode(event.target.value as SortMode)} className={selectClass}>{sortOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
            </div>
          )}
        </section>

        <section ref={rankingRef} className="mt-6 scroll-mt-5">
          <div className="mb-3 flex items-end justify-between gap-3">
            <div><p className="text-[10px] font-black tracking-[0.16em] text-blue-600 dark:text-blue-400">CANDIDATES</p><h2 className="mt-1 text-xl font-black">候補ランキング</h2></div>
            <span className="text-xs font-bold text-slate-400">{filteredStocks.length}銘柄</span>
          </div>
          <div className="space-y-3">
            {visibleStocks.length ? visibleStocks.map((stock, index) => <RankingCard key={stock.code} stock={stock} rank={index + podiumStocks.length + 1} />) : <p className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm font-bold text-slate-500 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">ほかに表示できる候補はありません</p>}
            {filteredStocks.length > 6 && <button type="button" onClick={() => setShowAll((value) => !value)} className="min-h-12 w-full rounded-2xl border border-blue-200 bg-white text-sm font-black text-blue-700 shadow-sm hover:bg-blue-50 dark:border-blue-800 dark:bg-slate-900 dark:text-blue-300 dark:hover:bg-blue-950">{showAll ? "表示を戻す" : "さらに表示（最大20位）"} <span aria-hidden>⌄</span></button>}
          </div>
        </section>

        <section className="mt-6 grid gap-3 md:grid-cols-2">
          <InfoCard icon="✦" title="AIスキャンの仕組み" text={`${(totalStocks || stocks.length).toLocaleString()}銘柄をAIが分析し、テクニカル指標・出来高・トレンド・検出パターンを総合的に判定してスコアリングしています。`} link="/learning" linkLabel="詳しく見る" />
          <InfoCard icon="◇" title="ご利用上の注意" text="AI分析は将来の株価を保証するものではありません。投資は自己責任で行い、利確・損切りのルールを決めて取引しましょう。" link="/terms" linkLabel="注意事項を確認" />
        </section>
        <BottomNav />
      </div>
    </main>
  );
}

function ScanLoadingCard() {
  return <section className="mt-3 rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm dark:border-slate-700 dark:bg-slate-900"><div className="mx-auto h-9 w-9 animate-spin rounded-full border-4 border-blue-100 border-t-blue-600 dark:border-slate-700 dark:border-t-blue-400" /><p className="mt-4 font-black text-slate-700 dark:text-slate-200">AIが候補を選定しています</p></section>;
}

function ScanSummary({ total, fetched, candidates, updated, market }: { total: number; fetched: number; candidates: number; updated: Date | null; market: ReturnType<typeof getMarketJudge> }) {
  return (
    <section className="mt-2 rounded-2xl border border-slate-200 bg-white px-3 py-2.5 shadow-sm dark:border-slate-700 dark:bg-slate-900 sm:px-4" aria-label="スキャン状況と相場判定">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] font-bold text-slate-500 dark:text-slate-400 sm:text-xs">
        <span>監視 <b className="text-slate-900 dark:text-slate-100">{total.toLocaleString()}銘柄</b></span>
        <span>取得 <b className="text-slate-900 dark:text-slate-100">{fetched.toLocaleString()}件</b></span>
        <span>候補 <b className="text-blue-600 dark:text-blue-400">{candidates.toLocaleString()}件</b></span>
        <span className="ml-auto">最終更新 <b className="text-slate-700 dark:text-slate-200">{updated ? updated.toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" }) : "--:--"}</b></span>
      </div>
      <div className="mt-2 flex items-center gap-2 border-t border-slate-100 pt-2 text-[11px] dark:border-slate-800 sm:text-xs">
        <span className="font-bold text-slate-500 dark:text-slate-400">相場判定</span>
        <strong className="text-emerald-600 dark:text-emerald-400">{market.label}</strong>
        <span className="ml-auto text-slate-500 dark:text-slate-400">強気度 <b className="text-slate-800 dark:text-slate-100">{market.strength}%</b></span>
        <span className="text-slate-500 dark:text-slate-400">リスク <b className="text-amber-600 dark:text-amber-400">{market.risk}</b></span>
      </div>
      <p className="mt-1.5 text-[10px] font-bold leading-4 text-blue-700 dark:text-blue-300 sm:text-xs">
        {market.label}・候補{candidates >= 5 ? "多数" : candidates > 0 ? "少数" : "なし"}・リスク{market.risk}：{marketGuidance(market, candidates)}
      </p>
    </section>
  );
}

function FetchWarning({ kind, onRetry, compact = false }: { kind: Exclude<FetchError, null>; onRetry: () => void; compact?: boolean }) {
  const timeout = kind === "timeout";
  return (
    <section className={`${compact ? "mt-2 flex items-center justify-between gap-3 px-3 py-2" : "mt-3 p-6 text-center"} rounded-2xl border border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200`} role="alert">
      <div className={compact ? "min-w-0" : ""}>
        <p className={`${compact ? "text-xs" : "text-base"} font-black`}>{timeout ? "取得に時間がかかっています" : "データを取得できませんでした"}</p>
        {!compact && <p className="mt-1 text-xs font-medium opacity-80">通信状況を確認して、もう一度お試しください。</p>}
      </div>
      <button type="button" onClick={onRetry} className={`${compact ? "min-h-9" : "mt-4 min-h-11"} shrink-0 rounded-xl border border-amber-300 bg-white px-4 text-xs font-black text-amber-800 shadow-sm dark:border-amber-700 dark:bg-slate-900 dark:text-amber-200`}>{timeout ? "再試行" : "再読み込み"}</button>
    </section>
  );
}

function EmptyResult({ onChangeConditions }: { onChangeConditions: () => void }) {
  return <section className="mt-3 rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm dark:border-slate-700 dark:bg-slate-900"><p className="text-base font-black">条件に合う候補がありません</p><p className="mt-1 text-xs text-slate-500 dark:text-slate-400">条件を変更して再検索してください</p><button type="button" onClick={onChangeConditions} className="mt-4 min-h-10 rounded-xl border border-blue-200 bg-blue-50 px-4 text-xs font-black text-blue-700 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-300">条件を変更</button></section>;
}

function FeaturedStock({ stock, metrics, onFavorite, totalStocks }: { stock: Stock; metrics: ReturnType<typeof getBestSignalMetrics>; onFavorite: () => void; totalStocks: number }) {
  const takeProfit = metrics?.takeProfit ?? stock.takeProfit;
  const stopLoss = metrics?.stopLoss ?? stock.stopLoss;
  const reasons = reasonItems(stock);
  const stars = Math.max(1, Math.min(5, Math.ceil(stock.score / 20)));
  const rr = riskReward({ ...stock, takeProfit, stopLoss });
  const rsiText = Number.isFinite(stock.rsi) ? Math.round(stock.rsi).toString() : "—";
  const requiredMoneyText = Number.isFinite(stock.price) ? yen(stock.price * 100) : "—";
  const aiWinRateText = Number.isFinite(stock.score)
    ? `${Math.min(95, Math.max(45, Math.round(stock.score * 0.75 + 12)))}%`
    : "—";
  const expectedProfitText = metrics && Number.isFinite(metrics.expectedProfit)
    ? `${metrics.expectedProfit > 0 ? "+" : ""}${yen(metrics.expectedProfit)}`
    : "—";
  const expectedLossText = Number.isFinite(stock.price) && Number.isFinite(stopLoss) && stopLoss !== undefined
    ? `-${yen(Math.max(0, (stock.price - stopLoss) * 100))}`
    : "—";
  const hasChangePercent = Number.isFinite(stock.changePercent);
  const changePercentText = hasChangePercent
    ? `${stock.changePercent > 0 ? "+" : ""}${stock.changePercent.toFixed(2)}%`
    : "—";
  const changePercentTone = !hasChangePercent || Math.abs(stock.changePercent) < 0.05
    ? "text-slate-500"
    : stock.changePercent > 0
      ? "text-emerald-600"
      : "text-rose-600";
  return (
    <article data-testid="scan-mobile-top-pick" className="group relative mt-3 overflow-hidden rounded-2xl border border-amber-300 bg-white p-4 shadow-sm transition hover:border-amber-400 hover:shadow-md dark:border-amber-700 dark:bg-slate-900 sm:p-5">
      <Link href={`/analysis/${stock.code}`} aria-label={`${stock.code} ${stock.name}の個別解析を見る`} className="absolute inset-0 z-0 rounded-2xl focus-visible:outline-2 focus-visible:outline-offset-[-3px] focus-visible:outline-blue-500" />
      <div className="pointer-events-none relative z-10">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0"><p className="text-[10px] font-black tracking-[0.12em] text-amber-700 dark:text-amber-400">🥇 本日の最有力候補</p><p className="mt-0.5 text-[10px] font-bold text-slate-500 dark:text-slate-400">約{totalStocks.toLocaleString()}銘柄からAIランキング1位</p></div>
          <button type="button" onClick={onFavorite} className="pointer-events-auto relative z-20 -mr-1 -mt-1 grid h-10 w-10 shrink-0 place-items-center rounded-full border border-amber-200 bg-amber-50 text-2xl text-amber-500 dark:border-amber-800 dark:bg-amber-950" aria-label={`${stock.name}をお気に入りに追加`}>☆</button>
        </div>
        <div className="mt-2 flex min-w-0 items-center gap-2"><span className="shrink-0 text-sm font-black text-slate-500 dark:text-slate-400">{stock.code}</span><h2 className="min-w-0 flex-1 truncate text-xl font-black">{stock.name}</h2><span className="shrink-0 rounded-full border border-orange-200 bg-orange-50 px-2.5 py-1 text-[10px] font-black text-orange-700 dark:border-orange-800 dark:bg-orange-950 dark:text-orange-300">{getSignal(stock.score)}</span></div>

        <div className="mt-3 grid grid-cols-[1.15fr_.85fr] gap-2 rounded-xl bg-slate-50 p-3 dark:bg-slate-800">
          <div><p className="text-[10px] font-black tracking-[0.14em] text-slate-500 dark:text-slate-400">AI POWER</p><p data-testid="scan-mobile-ai-power" className="mt-0.5 text-5xl font-black leading-none tracking-tight text-blue-600 dark:text-blue-400">{scoreText(stock.score)}</p><p className="mt-1.5 text-[8px] font-bold text-slate-400"><span className="mr-1">補助評価</span>{getRank(stock.score)}ランク・{"★".repeat(stars)}・AI勝率 {aiWinRateText}</p></div>
          <dl className="space-y-1.5 text-xs"><div className="flex justify-between gap-2"><dt className="text-slate-500 dark:text-slate-400">現在値</dt><dd className="font-black">{yen(stock.price)}</dd></div><div className="flex justify-between gap-2"><dt className="text-slate-500 dark:text-slate-400">変化率</dt><dd className={`font-black ${changePercentTone}`}>{changePercentText}</dd></div><div className="flex justify-between gap-2"><dt className="text-slate-500 dark:text-slate-400">必要資金</dt><dd className="font-black text-orange-600 dark:text-orange-400">{requiredMoneyText}</dd></div></dl>
        </div>

        <section className="mt-3">
          <h3 className="text-xs font-black text-slate-500 dark:text-slate-400">主な注目理由</h3>
          {reasons.length ? <><ul className="mt-1.5 space-y-1">{reasons.slice(0, 3).map((reason) => <li key={reason} className="flex gap-2 text-xs font-bold leading-5 text-slate-700 dark:text-slate-200"><span className="text-emerald-600 dark:text-emerald-400">✓</span><span>{reason}</span></li>)}</ul>{reasons.length > 3 && <details className="pointer-events-auto relative z-20 mt-1"><summary className="cursor-pointer py-1 text-xs font-black text-blue-600 dark:text-blue-400">＋ほか{reasons.length - 3}件</summary><ul className="mt-1 space-y-1 border-t border-slate-100 pt-2 dark:border-slate-800">{reasons.slice(3).map((reason) => <li key={reason} className="flex gap-2 text-xs leading-5 text-slate-600 dark:text-slate-300"><span className="text-emerald-600 dark:text-emerald-400">✓</span><span>{reason}</span></li>)}</ul></details>}</> : <p className="mt-1 text-xs text-slate-400">—</p>}
        </section>

        <dl data-testid="scan-mobile-trade-metrics" className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 rounded-xl border border-slate-200 bg-white p-3 text-xs dark:border-slate-700 dark:bg-slate-800"><CompactTradeRow label="利益目安" value={yen(takeProfit)} tone="text-emerald-600 dark:text-emerald-400" /><CompactTradeRow label="損失目安" value={yen(stopLoss)} tone="text-red-600 dark:text-red-400" /><CompactTradeRow label="期待利益" value={expectedProfitText} tone="text-emerald-600 dark:text-emerald-400" /><CompactTradeRow label="想定損失" value={expectedLossText} tone="text-red-600 dark:text-red-400" /><CompactTradeRow label="損益比" value={rr} tone="text-blue-600 dark:text-blue-400" /><CompactTradeRow label="RSI" value={rsiText} tone="text-slate-700 dark:text-slate-200" /></dl>
        <p className="mt-2 text-[10px] font-bold text-slate-500 dark:text-slate-400">候補抽出結果です。売買前に個別解析をご確認ください</p>
        <div className="mt-2.5 grid gap-2"><span className="flex min-h-11 items-center justify-center rounded-xl bg-blue-600 px-4 text-sm font-black text-white shadow-sm transition group-hover:bg-blue-700 dark:bg-blue-500 dark:group-hover:bg-blue-400">個別解析を見る →</span><Link href={`/chart/${stock.code}`} className="pointer-events-auto relative z-20 flex min-h-9 items-center justify-center text-xs font-black text-slate-500 hover:text-blue-700 dark:text-slate-400 dark:hover:text-blue-300">チャートを見る →</Link></div>
      </div>
    </article>
  );
}

function CompactTradeRow({ label, value, tone }: { label: string; value: string; tone: string }) {
  return <div className="flex min-w-0 items-baseline justify-between gap-2"><dt className="shrink-0 text-[10px] font-bold text-slate-500 dark:text-slate-400">{label}</dt><dd className={`truncate font-black tabular-nums ${tone}`}>{value}</dd></div>;
}

function PodiumStockCard({ stock, rank }: { stock: Stock; rank: 2 | 3 | number }) {
  const isSecond = rank === 2;
  const reasons = reasonItems(stock).slice(0, 2);
  return (
    <Link href={`/analysis/${stock.code}`} aria-label={`${rank}位 ${stock.code} ${stock.name}の個別解析を見る`} className="group rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-md dark:border-slate-700 dark:bg-slate-900 dark:hover:border-blue-700">
      <div className="flex items-start gap-2.5"><span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl border text-sm font-black ${isSecond ? "border-slate-300 bg-slate-100 text-slate-700 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100" : "border-orange-300 bg-orange-100 text-orange-800 dark:border-orange-700 dark:bg-orange-950 dark:text-orange-200"}`}>{rank}</span><div className="min-w-0 flex-1"><p className="text-[10px] font-bold text-slate-500 dark:text-slate-400">{stock.code}</p><h3 className="truncate text-base font-black">{stock.name}</h3></div><span className="rounded-full border border-orange-200 bg-orange-50 px-2 py-1 text-[9px] font-black text-orange-700 dark:border-orange-800 dark:bg-orange-950 dark:text-orange-300">{getSignal(stock.score)}</span></div>
      <StockMetrics stock={stock} />
      {reasons.length > 0 && <ul className="mt-2 space-y-0.5">{reasons.map((reason) => <li key={reason} className="flex gap-1.5 text-[11px] font-medium leading-4 text-slate-600 dark:text-slate-300"><span className="text-emerald-600 dark:text-emerald-400">✓</span><span className="truncate">{reason}</span></li>)}</ul>}
      <p className="mt-2 text-right text-[11px] font-black text-blue-600 dark:text-blue-400">個別解析を見る →</p>
    </Link>
  );
}

function RankingCard({ stock, rank }: { stock: Stock; rank: number }) {
  const reasons = reasonItems(stock).slice(0, 2);
  return (
    <Link href={`/analysis/${stock.code}`} aria-label={`${rank}位 ${stock.code} ${stock.name}の個別解析を見る`} className="group block rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm transition hover:border-blue-300 hover:shadow-md dark:border-slate-700 dark:bg-slate-900 dark:hover:border-blue-700 sm:p-4">
      <div className="flex min-w-0 items-center gap-2.5"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-slate-100 text-xs font-black text-slate-700 dark:bg-slate-800 dark:text-slate-200">{rank}</span><div className="min-w-0 flex-1"><p className="text-[10px] font-bold text-slate-500 dark:text-slate-400">{stock.code}</p><h3 className="truncate text-sm font-black">{stock.name}</h3></div><span className="rounded-full border border-blue-200 bg-blue-50 px-2 py-1 text-[9px] font-black text-blue-700 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-300">{getSignal(stock.score)}</span></div>
      <StockMetrics stock={stock} />
      {reasons.length > 0 && <p className="mt-2 truncate text-[11px] text-slate-500 dark:text-slate-400">✓ {reasons.join("　✓ ")}</p>}
      <p className="mt-2 text-right text-[11px] font-black text-blue-600 dark:text-blue-400">個別解析を見る →</p>
    </Link>
  );
}

function StockMetrics({ stock }: { stock: Stock }) {
  const changeTone = Math.abs(stock.changePercent) < 0.05 ? "text-slate-500 dark:text-slate-400" : stock.changePercent > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400";
  return <dl className="mt-2.5 grid grid-cols-2 gap-x-4 gap-y-1.5 rounded-xl bg-slate-50 p-2.5 text-[11px] dark:bg-slate-800 sm:grid-cols-4"><Metric label="AI POWER" value={scoreText(stock.score)} tone="text-blue-600 dark:text-blue-400" /><Metric label="変化率" value={`${stock.changePercent > 0 ? "+" : ""}${stock.changePercent.toFixed(2)}%`} tone={changeTone} /><Metric label="出来高" value={`${stock.volumeRatio.toFixed(2)}倍`} tone="text-orange-600 dark:text-orange-400" /><Metric label="必要資金" value={yen(stock.price * 100)} tone="text-slate-800 dark:text-slate-100" /></dl>;
}

function Metric({ label, value, tone }: { label: string; value: string; tone: string }) {
  return <div className="flex min-w-0 items-baseline justify-between gap-2"><dt className="shrink-0 text-[9px] font-bold text-slate-500 dark:text-slate-400">{label}</dt><dd className={`truncate font-black tabular-nums ${tone}`}>{value}</dd></div>;
}

function InfoCard({ icon, title, text, link, linkLabel }: { icon: string; title: string; text: string; link: string; linkLabel: string }) {
  return <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900"><div className="flex gap-3"><span className="text-2xl text-blue-600 dark:text-blue-400" aria-hidden="true">{icon}</span><div><h3 className="font-black text-slate-900 dark:text-slate-100">{title}</h3><p className="mt-2 text-xs font-semibold leading-6 text-slate-500 dark:text-slate-400">{text}</p><Link href={link} className="mt-3 inline-block text-xs font-black text-blue-600 dark:text-blue-400">{linkLabel}　›</Link></div></div></article>;
}
