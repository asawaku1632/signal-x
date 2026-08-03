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

function primaryPattern(stock: Stock) {
  return reasonItems(stock)[0] ?? "—";
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

function getMarketJudge(hot: number, strong: number) {
  if (hot >= 80) return { label: "超強気", risk: "高", strength: 92 };
  if (hot >= 30) return { label: "強気", risk: "中", strength: 78 };
  if (hot >= 10) return { label: "やや強気", risk: "中", strength: 65 };
  if (strong >= 30) return { label: "厳選", risk: "中", strength: 54 };
  return { label: "静観", risk: "低", strength: 38 };
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
    <main className="grid min-h-screen place-items-center bg-[#f7f8fc] px-5 text-[#101b3f]">
      <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-violet-100 border-t-violet-600" />
        <p className="mt-5 text-lg font-black">AIスキャンを準備しています</p>
        <p className="mt-2 text-sm text-slate-500">約1000銘柄から今日の候補を探しています。</p>
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
  const rankingRef = useRef<HTMLElement>(null);
  const fetchingRef = useRef(false);

  const fetchStocks = useCallback(async () => {
    if (fetchingRef.current) return;
    fetchingRef.current = true;
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 90_000);

    try {
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
        console.warn("scan-mobile fetch timeout");
      } else {
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

  const selectClass = "min-h-11 w-full appearance-none rounded-xl border border-violet-100 bg-violet-50 px-3 pr-8 text-xs font-bold text-violet-700 outline-none transition focus:border-violet-400 focus:ring-2 focus:ring-violet-100";

  return (
    <main className="min-h-screen bg-[#fafbfe] pb-28 text-[#101b3f]">
      <div className="mx-auto w-full max-w-[1180px] px-4 pb-10 pt-5 sm:px-6 lg:px-8">
        <header className="flex items-center justify-between gap-4 py-2">
          <Link href="/dashboard" className="flex items-center gap-3" aria-label="SIGNALX ホーム">
            <span className="relative grid h-12 w-12 place-items-center text-4xl font-black italic text-violet-600" aria-hidden="true">X</span>
            <span>
              <span className="block text-[1.7rem] font-black leading-none tracking-tight">SIGNAL<span className="text-violet-600">X</span></span>
              <span className="mt-1 block text-[9px] font-black tracking-[0.22em] text-slate-500">AI STOCK SCAN</span>
            </span>
          </Link>
          <button type="button" onClick={() => void fetchStocks()} disabled={loading} className="inline-flex min-h-12 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold shadow-[0_4px_14px_rgba(15,23,42,0.07)] transition hover:border-violet-200 hover:text-violet-700 disabled:opacity-50">
            <span className={loading ? "animate-spin" : ""} aria-hidden="true">↻</span> 更新
          </button>
        </header>

        <div className="mt-8">
          <h1 className="text-3xl font-black tracking-tight sm:text-4xl">スキャン</h1>
          <p className="mt-2 text-sm font-semibold text-slate-500 sm:text-base">AIが約1000銘柄を監視して、今日の買い候補を抽出</p>
        </div>

        <section className="mt-6 grid grid-cols-2 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_5px_20px_rgba(15,23,42,0.06)] sm:grid-cols-4">
          <StatusCell icon="◉" label="監視銘柄数" value={totalStocks || stocks.length} unit="銘柄" color="text-violet-600" />
          <StatusCell icon="✓" label="取得済み" value={stocks.length} unit="銘柄" color="text-emerald-600" />
          <StatusCell icon="◎" label="候補銘柄" value={candidateCount} unit="銘柄" color="text-blue-600" />
          <StatusCell icon="◷" label="最終更新" value={lastUpdated ? lastUpdated.toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" }) : "--:--"} unit={lastUpdated ? "今日" : "更新待ち"} color="text-slate-500" last />
        </section>

        <section className="mt-5 grid items-center rounded-2xl border border-slate-200 bg-white px-5 py-5 shadow-[0_5px_20px_rgba(15,23,42,0.06)] md:grid-cols-[1fr_1fr_.75fr] md:px-7">
          <div className="flex items-center border-b border-slate-100 pb-5 md:border-b-0 md:border-r md:pb-0">
            <div><p className="text-xs font-black tracking-[0.12em] text-violet-600">AI市場判定</p><p className="mt-1 text-2xl font-black text-emerald-600">{market.label}</p><p className="mt-1 rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-bold text-emerald-700">AIが市場全体を分析</p></div>
          </div>
          <div className="flex items-center justify-center gap-5 border-b border-slate-100 py-5 md:border-b-0 md:border-r md:py-0">
            <div className="relative h-20 w-36 overflow-hidden"><div className="absolute inset-x-0 top-0 h-36 rounded-full bg-[conic-gradient(from_270deg,#10b981_0deg,#10b981_calc(var(--strength)*1.8deg),#edf0f5_calc(var(--strength)*1.8deg),#edf0f5_180deg,transparent_180deg)]" style={{ "--strength": market.strength } as React.CSSProperties} /><div className="absolute inset-x-3 top-3 h-28 rounded-full bg-white" /></div>
            <div className="-ml-32 mt-4 text-center"><p className="text-xs font-bold text-slate-500">強気度</p><p className="text-3xl font-black">{market.strength}<span className="text-sm">%</span></p></div>
          </div>
          <div className="pt-5 text-center md:pt-0"><p className="text-xs font-bold text-slate-500">市場リスク</p><p className="mt-2 text-2xl font-black text-amber-500"><span aria-hidden="true">▲</span> {market.risk}</p></div>
        </section>

        <section className="mt-5 grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_5px_20px_rgba(15,23,42,0.06)] sm:grid-cols-[1fr_1fr_1fr_auto] sm:items-end">
          <label className="block"><span className="mb-2 block text-[11px] font-bold text-slate-500">候補条件</span><select value={signalFilter} onChange={(event) => setSignalFilter(event.target.value as SignalFilter)} className={selectClass}><option value="strong">買い候補</option><option value="hot">今日の最有力</option><option value="all">すべて</option><option value="market-hot">市場の激熱候補</option><option value="market-watch">市場の注目候補</option></select></label>
          <label className="block"><span className="mb-2 block text-[11px] font-bold text-slate-500">必要資金</span><select value={budgetFilter} onChange={(event) => setBudgetFilter(event.target.value === "all" ? "all" : Number(event.target.value) as BudgetFilter)} className={selectClass}>{budgetOptions.map((option) => <option key={option.label} value={option.value}>{option.label}</option>)}</select></label>
          <label className="block"><span className="mb-2 block text-[11px] font-bold text-slate-500">並び順</span><select value={sortMode} onChange={(event) => setSortMode(event.target.value as SortMode)} className={selectClass}>{sortOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
          <button type="button" onClick={() => rankingRef.current?.scrollIntoView({ behavior: "smooth" })} className="min-h-11 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-5 text-sm font-black text-white shadow-lg shadow-violet-200">条件を適用</button>
        </section>

        {loading && stocks.length === 0 ? <ScanLoadingCard /> : bestSignal ? (
          <FeaturedStock stock={bestSignal} metrics={bestSignalMetrics} onFavorite={() => void addFavorite(bestSignal.code, bestSignal.name)} />
        ) : (
          <section className="mt-5 rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm"><p className="text-lg font-black">現在の条件に合う候補はありません</p><p className="mt-2 text-sm text-slate-500">予算や候補条件を変更して確認してください。</p></section>
        )}

        {podiumStocks.length > 1 && (
          <section className="mt-4 grid gap-3 sm:grid-cols-2" aria-label="上位候補">
            {podiumStocks.slice(1).map((stock, index) => (
              <PodiumStockCard key={stock.code} stock={stock} rank={index + 2} />
            ))}
          </section>
        )}

        <section ref={rankingRef} className="mt-7 scroll-mt-5">
          <div className="mb-3 flex items-end justify-between"><div><h2 className="text-xl font-black">AIランキング</h2><p className="mt-1 text-xs font-semibold text-slate-500">{signalLabel(signalFilter)}・{budgetLabel(budgetFilter)}</p></div><span className="text-xs font-bold text-slate-400">{filteredStocks.length}銘柄</span></div>
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_5px_20px_rgba(15,23,42,0.06)]">
            {visibleStocks.length ? visibleStocks.map((stock, index) => <RankingRow key={stock.code} stock={stock} rank={index + podiumStocks.length + 1} />) : <p className="p-8 text-center text-sm font-bold text-slate-500">ほかに表示できる候補はありません</p>}
            {filteredStocks.length > 6 && <button type="button" onClick={() => setShowAll((value) => !value)} className="min-h-14 w-full border-t border-slate-100 text-sm font-black text-[#101b3f] hover:bg-slate-50">{showAll ? "表示を戻す" : `さらに表示（最大20位）`} <span aria-hidden="true">⌄</span></button>}
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

function StatusCell({ icon, label, value, unit, color, last = false }: { icon: string; label: string; value: number | string; unit: string; color: string; last?: boolean }) {
  return <div className={`flex min-h-28 items-center gap-3 border-b border-r border-slate-100 px-4 py-4 sm:border-b-0 ${last ? "border-r-0" : ""}`}><span className={`text-2xl ${color}`} aria-hidden="true">{icon}</span><div><p className="text-xs font-bold text-slate-500">{label}</p><p className="mt-1 text-2xl font-black tabular-nums sm:text-3xl">{typeof value === "number" ? value.toLocaleString() : value}</p><p className="text-xs font-semibold text-slate-500">{unit}</p></div></div>;
}

function ScanLoadingCard() {
  return <section className="mt-5 rounded-2xl border border-violet-200 bg-white p-10 text-center shadow-sm"><div className="mx-auto h-9 w-9 animate-spin rounded-full border-4 border-violet-100 border-t-violet-600" /><p className="mt-4 font-black">AIが候補を選定しています</p></section>;
}

function FeaturedStock({ stock, metrics, onFavorite }: { stock: Stock; metrics: ReturnType<typeof getBestSignalMetrics>; onFavorite: () => void }) {
  const takeProfit = metrics?.takeProfit ?? stock.takeProfit;
  const stopLoss = metrics?.stopLoss ?? stock.stopLoss;
  const reasons = reasonItems(stock);
  const stars = Math.max(1, Math.min(5, Math.ceil(stock.score / 20)));
  const rr = riskReward({ ...stock, takeProfit, stopLoss });
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
    <article data-testid="scan-mobile-top-pick" className="relative mt-5 overflow-hidden rounded-[28px] border border-amber-300 bg-[linear-gradient(145deg,#fffdf7_0%,#ffffff_48%,#fff6d5_100%)] p-4 shadow-[0_18px_48px_rgba(180,125,20,0.16)] sm:p-6">
      <div className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-amber-200/40 blur-3xl" />
      <div className="relative">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-gradient-to-br from-amber-200 to-amber-500 text-2xl shadow-[0_8px_20px_rgba(217,154,22,0.26)]" aria-label="ゴールドメダル">🥇</span>
            <div className="min-w-0 flex-1"><p className="text-[10px] font-black tracking-[0.14em] text-amber-800">本日の最有力候補</p><h2 className="mt-1 truncate text-2xl font-black leading-tight">{stock.name}<span className="ml-1.5 text-base font-bold text-slate-500">（{stock.code}）</span></h2><div className="mt-1.5 flex items-baseline justify-between gap-5 text-xs font-bold text-slate-500"><p className="shrink-0">現在値 <span className="ml-1 text-sm font-black tabular-nums text-slate-800">{yen(stock.price)}</span></p><p className={`shrink-0 text-sm font-black tabular-nums ${changePercentTone}`}>{changePercentText}</p></div></div>
          </div>
          <button type="button" onClick={onFavorite} className="shrink-0 text-3xl text-amber-500" aria-label={`${stock.name}をお気に入りに追加`}>☆</button>
        </div>

        <div className="mt-3.5 rounded-2xl border border-amber-200/80 bg-white/80 p-3.5 backdrop-blur">
          <div className="flex items-center justify-between gap-3"><div><p className="text-[10px] font-black tracking-[0.18em] text-amber-700">AI総合評価</p><p data-testid="scan-mobile-ai-evaluation" className="mt-0.5 text-5xl font-black leading-none tracking-[-0.055em] text-slate-950 sm:text-6xl">{scoreText(stock.score)}<span className="ml-1 text-sm tracking-normal text-slate-400">/100</span></p></div><div className="text-right"><span className="inline-flex rounded-full border border-amber-300 bg-gradient-to-r from-amber-100 to-yellow-50 px-2.5 py-1 text-[10px] font-black tracking-wide text-amber-800 shadow-sm">{getSignal(stock.score)}</span><p className="mt-1.5 text-sm tracking-wider text-amber-500" aria-label={`5段階中${stars}`}>{"★".repeat(stars)}<span className="text-slate-200">{"★".repeat(5 - stars)}</span></p><span data-testid="scan-mobile-rank" className="mt-1 inline-flex rounded-md bg-slate-950 px-2 py-0.5 text-[11px] font-black text-white">{getRank(stock.score)}ランク</span></div></div>
          <div data-testid="scan-mobile-ai-power" className="mt-3"><div className="flex items-baseline justify-between gap-3 text-[11px] font-black"><span className="tracking-[0.16em] text-slate-500">AI POWER <span className="text-base text-slate-950">{scoreText(stock.score)}</span></span></div><div className="mt-1.5 h-2 overflow-hidden rounded-full bg-amber-100"><div className="h-full rounded-full bg-gradient-to-r from-amber-400 via-yellow-500 to-amber-600" style={{ width: `${Math.min(Math.max(stock.score, 0), 100)}%` }} /></div></div>
        </div>

        <section className="mt-3 rounded-2xl border border-amber-200/80 bg-white/80 p-3.5">
          <h3 className="text-sm font-black text-slate-900">AIが注目した理由</h3>
          {reasons.length ? <><ul className="mt-2 space-y-1">{reasons.slice(0, 3).map((reason) => <li key={reason} className="flex gap-2 text-sm font-bold leading-5 text-slate-700"><span className="text-emerald-600">✓</span><span>{reason}</span></li>)}</ul>{reasons.length > 3 && <details className="mt-2"><summary className="cursor-pointer text-sm font-black text-blue-600">もっと見る ↓</summary><ul className="mt-2 space-y-1 border-t border-slate-100 pt-2">{reasons.slice(3).map((reason) => <li key={reason} className="flex gap-2 text-sm leading-5 text-slate-600"><span className="text-emerald-600">✓</span><span>{reason}</span></li>)}</ul></details>}</> : <p className="mt-2 text-sm text-slate-400">—</p>}
        </section>

        <div data-testid="scan-mobile-trade-metrics" className="mt-3 grid grid-cols-3 gap-2"><TradeMetric label="利確" value={yen(takeProfit)} tone="emerald" /><TradeMetric label="損切" value={yen(stopLoss)} tone="red" /><TradeMetric label="R:R" value={rr} tone="blue" /></div>
        <Link href={`/analysis/${stock.code}`} className="mt-3 flex min-h-10 items-center justify-center rounded-xl bg-slate-950 px-5 py-2 text-sm font-black text-white shadow-md">{stock.name} のAI分析を見る　→</Link>
      </div>
    </article>
  );
}

function TradeMetric({ label, value, tone }: { label: string; value: string; tone: "emerald" | "red" | "blue" }) {
  const tones = { emerald: "bg-emerald-50 text-emerald-700", red: "bg-red-50 text-red-700", blue: "bg-blue-50 text-blue-700" };
  return <div className={`flex min-h-20 flex-col items-center justify-center rounded-xl px-1 py-2 text-center ${tones[tone]}`}><p className="text-lg font-black leading-none tabular-nums sm:text-xl">{value}</p><p className="mt-1.5 text-[10px] font-black tracking-wide opacity-75">{label}</p></div>;
}

function PodiumStockCard({ stock, rank }: { stock: Stock; rank: 2 | 3 | number }) {
  const isSecond = rank === 2;
  const changeTone = stock.changePercent >= 0 ? "text-emerald-700" : "text-rose-600";
  return (
    <Link href={`/analysis/${stock.code}`} aria-label={`${rank}位 ${stock.code} ${stock.name}の個別解析を見る`} className={`group relative overflow-hidden rounded-3xl border-2 p-5 transition hover:-translate-y-0.5 hover:shadow-lg ${isSecond ? "border-slate-400 bg-[linear-gradient(135deg,#ffffff_0%,#eef1f5_52%,#d9dee7_100%)] shadow-[0_14px_32px_rgba(71,85,105,0.16)]" : "border-amber-700/60 bg-[linear-gradient(135deg,#fffdf9_0%,#f8e8d5_52%,#e8c39e_100%)] shadow-[0_14px_32px_rgba(146,64,14,0.16)]"}`}>
      <div className="flex items-start gap-4">
        <span className={`grid h-16 w-16 shrink-0 place-items-center rounded-full border-4 text-2xl font-black shadow-lg ${isSecond ? "border-slate-100 bg-gradient-to-br from-white via-slate-200 to-slate-500 text-slate-700" : "border-orange-100 bg-gradient-to-br from-amber-100 via-orange-300 to-amber-800 text-amber-950"}`} aria-label={`${rank}位メダル`}>{rank}</span>
        <div className="min-w-0 flex-1"><p className={`text-xs font-black tracking-[0.12em] ${isSecond ? "text-slate-700" : "text-amber-900"}`}>第{rank}候補</p><h3 className="mt-1 truncate text-xl font-black">{stock.name}</h3><p className="mt-1 text-xs font-bold text-slate-600">{stock.code}</p></div>
        <div className="shrink-0 text-right"><p className="text-[10px] font-black text-slate-500">AI評価</p><p className={`text-3xl font-black ${isSecond ? "text-slate-800" : "text-amber-950"}`}>{scoreText(stock.score)}</p></div>
      </div>
      <div className="mt-4 grid grid-cols-[1fr_auto] items-end gap-3 border-t border-current/10 pt-3"><div className="min-w-0"><p className="text-sm font-black">{yen(stock.price)} <span className={`ml-1 text-xs ${changeTone}`}>{stock.changePercent >= 0 ? "+" : ""}{stock.changePercent.toFixed(2)}%</span></p><p className="mt-1 truncate text-xs font-semibold text-slate-600">主要パターン：{primaryPattern(stock)}</p></div><span className="text-xl" aria-hidden="true">›</span></div>
    </Link>
  );
}

function RankingRow({ stock, rank }: { stock: Stock; rank: number }) {
  return (
    <Link href={`/analysis/${stock.code}`} aria-label={`${rank}位 ${stock.code} ${stock.name}の個別解析を見る`} className="grid min-h-16 grid-cols-[2rem_minmax(0,1fr)_auto] items-center gap-x-2 border-b border-slate-100 px-3 py-2.5 transition hover:bg-violet-50/40 sm:grid-cols-[2.5rem_minmax(9rem,1.2fr)_5rem_6rem_minmax(8rem,1fr)_1rem] sm:gap-3 sm:px-5">
      <span className="grid h-8 w-8 place-items-center rounded-md bg-slate-100 text-sm font-black text-slate-700">{rank}</span>
      <div className="min-w-0"><p className="truncate text-xs font-bold text-slate-500">{stock.code}</p><p className="truncate text-sm font-black">{stock.name}</p><p className="mt-0.5 truncate text-[10px] font-semibold text-slate-500 sm:hidden">{primaryPattern(stock)}</p></div>
      <div className="text-right sm:text-left"><p className="text-sm font-black text-violet-700">{scoreText(stock.score)}</p><p className="text-[9px] font-bold text-slate-400">AI評価</p><p className="mt-1 text-[10px] font-black sm:hidden">{yen(stock.price)}</p><p className={`text-[9px] font-bold sm:hidden ${stock.changePercent >= 0 ? "text-emerald-600" : "text-rose-500"}`}>{stock.changePercent >= 0 ? "+" : ""}{stock.changePercent.toFixed(2)}%</p><span className="text-lg text-slate-400 sm:hidden" aria-hidden="true">›</span></div>
      <div className="hidden sm:block"><p className="text-xs font-black">{yen(stock.price)}</p><p className={`text-[10px] font-bold ${stock.changePercent >= 0 ? "text-emerald-600" : "text-rose-500"}`}>{stock.changePercent >= 0 ? "+" : ""}{stock.changePercent.toFixed(2)}%</p></div>
      <p className="hidden truncate text-xs font-semibold text-slate-600 sm:block">{primaryPattern(stock)}</p>
      <span className="hidden text-lg text-slate-400 sm:block" aria-hidden="true">›</span>
    </Link>
  );
}

function InfoCard({ icon, title, text, link, linkLabel }: { icon: string; title: string; text: string; link: string; linkLabel: string }) {
  return <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex gap-3"><span className="text-2xl text-violet-600" aria-hidden="true">{icon}</span><div><h3 className="font-black text-violet-700">{title}</h3><p className="mt-2 text-xs font-semibold leading-6 text-slate-500">{text}</p><Link href={link} className="mt-3 inline-block text-xs font-black text-violet-600">{linkLabel}　›</Link></div></div></article>;
}
