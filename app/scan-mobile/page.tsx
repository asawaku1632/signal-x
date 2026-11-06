"use client";

import Link from "next/link";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import BottomNav from "@/app/components/BottomNav";
import { scanDisplayLabels } from "@/app/lib/scanDisplayLabels";
import { rankDailyScanCandidates } from "@/app/lib/scanDailyRanking";
import type { ScanDetectedPattern } from "@/app/components/scan/DetectedPatternSummary";

type Stock = {
  code: string;
  name: string;
  score: number;
  price: number;
  changePercent: number;
  volumeRatio: number;
  reason: string;
  detectedPatterns?: ScanDetectedPattern[];
};

type SignalFilter = "hot" | "strong" | "market-hot" | "market-watch" | "all";
type BudgetFilter = 10000 | 100000 | 300000 | 500000 | 1000000 | "all";
type SortMode = "score" | "change" | "down" | "cheap" | "expensive" | "money";
type FetchError = "api" | "timeout" | null;

const budgetOptions: { label: string; shortLabel: string; value: BudgetFilter }[] = [
  { label: "1万円以内", shortLabel: "1万", value: 10000 },
  { label: "10万円以内", shortLabel: "10万", value: 100000 },
  { label: "30万円以内", shortLabel: "30万", value: 300000 },
  { label: "50万円以内", shortLabel: "50万", value: 500000 },
  { label: "100万円以内", shortLabel: "100万", value: 1000000 },
  { label: "制限なし", shortLabel: "制限なし", value: "all" },
];

const quickBudgetValues: BudgetFilter[] = [100000, 300000, 500000, 1000000, "all"];
const sortOptions: { label: string; value: SortMode }[] = [
  { label: "AI評価順", value: "score" },
  { label: "上昇率順", value: "change" },
  { label: "下落率順", value: "down" },
  { label: "株価が安い順", value: "cheap" },
  { label: "株価が高い順", value: "expensive" },
  { label: "必要資金順", value: "money" },
];

function yen(value: number) {
  return Number.isFinite(value) ? Math.round(value).toLocaleString("ja-JP") + "円" : "—";
}

function scoreText(value: number) {
  if (!Number.isFinite(value)) return "—";
  return Number.isInteger(value) ? value.toFixed(0) : value.toFixed(1);
}

function changeText(value: number) {
  if (!Number.isFinite(value)) return "—";
  return (value > 0 ? "+" : "") + value.toFixed(2) + "%";
}

function reasonItems(stock: Stock) {
  const patterns = (stock.detectedPatterns ?? []).map((pattern) => pattern.name);
  const reasons = (stock.reason ?? "").split(/[｜|、,，。\n・]+/)
    .map((item) => item.trim().replace(/^[✓✔︎✅\-\s]+/, ""))
    .filter(Boolean);
  return Array.from(new Set([...patterns, ...reasons]));
}

function ScanLoading() {
  return (
    <main className="grid min-h-screen place-items-center bg-slate-50 px-4 text-slate-800 dark:bg-slate-950 dark:text-slate-100">
      <p className="text-sm font-bold">注目株ランキングを読み込んでいます…</p>
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
    filterParam === "hot" || filterParam === "strong" || filterParam === "all" ||
    filterParam === "market-hot" || filterParam === "market-watch"
      ? filterParam : "strong";
  const budgetNumber = Number(budgetParam);
  const initialBudget: BudgetFilter =
    budgetParam === "all" ? "all" :
      budgetOptions.some((item) => item.value === budgetNumber)
        ? (budgetNumber as BudgetFilter) : 100000;

  const [stocks, setStocks] = useState<Stock[]>([]);
  const [totalStocks, setTotalStocks] = useState(0);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [marketClosed, setMarketClosed] = useState(false);
  const [marketDateJst, setMarketDateJst] = useState<string | null>(null);
  const displayLabels = scanDisplayLabels(marketClosed);
  const [quoteDateRange, setQuoteDateRange] = useState<{ oldest: string | null; latest: string | null }>({
    oldest: null, latest: null,
  });
  const [signalFilter, setSignalFilter] = useState<SignalFilter>(initialSignalFilter);
  const [budgetFilter, setBudgetFilter] = useState<BudgetFilter>(initialBudget);
  const [sortMode, setSortMode] = useState<SortMode>("score");
  const [showMore, setShowMore] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [fetchError, setFetchError] = useState<FetchError>(null);
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
      const response = await fetch("/api/scan?" + params.toString(), {
        cache: "no-store", signal: controller.signal,
      });
      if (!response.ok) throw new Error("scan api error: " + response.status);
      const json = await response.json();
      const list: Stock[] = Array.isArray(json)
        ? json : Array.isArray(json?.stocks) ? json.stocks : [];
      if (list.length === 0) throw new Error("scan api returned empty stocks");
      setStocks(list);
      setTotalStocks(Number(json?.totalStockList ?? list.length));
      const savedAt = typeof json?.updatedAt === "string" ? new Date(json.updatedAt) : null;
      setLastUpdated(savedAt && Number.isFinite(savedAt.getTime()) ? savedAt : null);
      setMarketClosed(json?.marketClosed === true);
      setMarketDateJst(typeof json?.marketDateJst === "string" ? json.marketDateJst : null);
      setQuoteDateRange({
        oldest: typeof json?.oldestQuoteDateJst === "string" ? json.oldestQuoteDateJst : null,
        latest: typeof json?.latestQuoteDateJst === "string" ? json.latestQuoteDateJst : null,
      });
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        setFetchError("timeout");
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
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Initial snapshot fetch on mount.
    void fetchStocks();
    const timer = window.setInterval(() => void fetchStocks(), 60_000);
    return () => window.clearInterval(timer);
  }, [fetchStocks]);

  const filteredStocks = useMemo(
    () => rankDailyScanCandidates(stocks, {
      budget: budgetFilter, filter: signalFilter, sort: sortMode,
    }),
    [stocks, budgetFilter, signalFilter, sortMode],
  );
  const topFive = filteredStocks.slice(0, 5);
  const moreStocks = filteredStocks.slice(5, 20);
  const quoteIsCurrent = Boolean(
    marketDateJst && quoteDateRange.latest && marketDateJst === quoteDateRange.latest,
  );
  const savedDataView = marketClosed || !quoteIsCurrent;
  const activeBudget = budgetOptions.find((item) => item.value === budgetFilter);
  const activeSort = sortOptions.find((item) => item.value === sortMode);

  const selectClass = "min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100";

  return (
    <main className="min-h-screen bg-slate-50 pb-28 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <div className="mx-auto max-w-2xl px-3 pb-7 pt-3 sm:px-5">
        <header className="flex items-center justify-between gap-3">
          <Link href="/dashboard" aria-label="SIGNALXホーム" className="flex items-center gap-2">
            <span className="text-3xl font-black italic text-blue-600 dark:text-blue-400">X</span>
            <span className="text-base font-black tracking-tight">SIGNAL<span className="text-blue-600 dark:text-blue-400">X</span></span>
          </Link>
          <button type="button" onClick={() => void fetchStocks()} disabled={loading}
            className="min-h-10 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold shadow-sm disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900">
            更新 ↻
          </button>
        </header>

        <section className="mt-3" aria-label="ランキングの条件">
          <div className="flex items-end justify-between gap-2">
            <div className="min-w-0">
              <h1 className="text-xl font-black leading-tight sm:text-2xl">
                {savedDataView ? "保存データの注目 TOP5" : "今日の注目 TOP5"}
              </h1>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                株価基準日 {quoteDateRange.latest ?? "確認中"} ・AI評価順の参考候補
              </p>
            </div>
            <span className="shrink-0 text-xs font-bold text-slate-500 dark:text-slate-400">
              {topFive.length}銘柄
            </span>
          </div>

          <div className="-mx-3 mt-3 flex gap-2 overflow-x-auto px-3 pb-2 sm:mx-0 sm:px-0" aria-label="予算で絞り込む">
            {budgetOptions.filter((option) => quickBudgetValues.includes(option.value)).map((option) => (
              <button key={option.label} type="button" aria-pressed={budgetFilter === option.value}
                onClick={() => { setBudgetFilter(option.value); setShowMore(false); }}
                className={"min-h-10 shrink-0 rounded-full border px-4 text-sm font-bold transition " +
                  (budgetFilter === option.value
                    ? "border-blue-600 bg-blue-600 text-white"
                    : "border-slate-200 bg-white text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200")}>
                {option.shortLabel}
              </button>
            ))}
          </div>

          <div className="mt-1 flex items-center justify-between gap-2">
            <p className="min-w-0 truncate text-xs font-semibold text-slate-500 dark:text-slate-400">
              {activeBudget?.label ?? "予算指定"} · {activeSort?.label ?? "AI評価順"}
            </p>
            <button type="button" aria-expanded={filtersOpen} onClick={() => setFiltersOpen((value) => !value)}
              className="min-h-9 shrink-0 rounded-lg px-3 text-sm font-bold text-blue-700 dark:text-blue-300">
              {filtersOpen ? "条件を閉じる ▲" : "並び替え・条件 ▼"}
            </button>
          </div>
          {filtersOpen && (
            <div className="mt-2 grid gap-3 rounded-2xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900 sm:grid-cols-3">
              <label className="grid gap-1 text-xs font-bold">
                候補の種類
                <select value={signalFilter} onChange={(event) => { setSignalFilter(event.target.value as SignalFilter); setShowMore(false); }} className={selectClass}>
                  <option value="strong">AI上位10件</option>
                  <option value="hot">{displayLabels.hotFilter}</option>
                  <option value="all">取得した候補すべて</option>
                  <option value="market-hot">市場の激熱候補</option>
                  <option value="market-watch">市場の注目候補</option>
                </select>
              </label>
              <label className="grid gap-1 text-xs font-bold">
                予算（100株）
                <select value={budgetFilter} onChange={(event) => { setBudgetFilter(event.target.value === "all" ? "all" : Number(event.target.value) as BudgetFilter); setShowMore(false); }} className={selectClass}>
                  {budgetOptions.map((option) => <option key={option.label} value={option.value}>{option.label}</option>)}
                </select>
              </label>
              <label className="grid gap-1 text-xs font-bold">
                並び順
                <select value={sortMode} onChange={(event) => { setSortMode(event.target.value as SortMode); setShowMore(false); }} className={selectClass}>
                  {sortOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              </label>
            </div>
          )}
        </section>

        {fetchError && stocks.length > 0 && (
          <p role="alert" className="mt-2 rounded-xl bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-800">
            更新に失敗しました。前回の表示データを使っています。
          </p>
        )}

        {loading && stocks.length === 0 ? (
          <section className="mt-3 rounded-2xl bg-white p-6 text-center text-sm font-semibold dark:bg-slate-900">
            保存済みの候補を読み込み中…
          </section>
        ) : fetchError && stocks.length === 0 ? (
          <section role="alert" className="mt-3 rounded-2xl bg-white p-5 dark:bg-slate-900">
            <p className="text-sm font-bold">{fetchError === "timeout" ? "取得に時間がかかっています" : "データを取得できませんでした"}</p>
            <button type="button" onClick={() => void fetchStocks()} className="mt-3 min-h-10 rounded-lg bg-blue-600 px-4 text-sm font-bold text-white">再読み込み</button>
          </section>
        ) : topFive.length > 0 ? (
          <section className="mt-2 space-y-2" aria-label="AI注目ランキング1位から5位">
            {topFive.map((stock, index) => (
              <CompactStockCard key={stock.code} stock={stock} rank={index + 1} />
            ))}
          </section>
        ) : (
          <section className="mt-3 rounded-2xl border border-slate-200 bg-white p-5 text-center dark:border-slate-700 dark:bg-slate-900">
            <p className="text-sm font-black">この予算・条件に合う候補はありません</p>
            <button type="button" onClick={() => setFiltersOpen(true)} className="mt-3 min-h-10 rounded-xl bg-blue-600 px-4 text-sm font-bold text-white">条件を変える</button>
          </section>
        )}

        {moreStocks.length > 0 && (
          <section className="mt-3">
            <button type="button" aria-expanded={showMore} onClick={() => setShowMore((value) => !value)}
              className="min-h-11 w-full rounded-xl border border-blue-200 bg-white text-sm font-bold text-blue-700 dark:border-blue-800 dark:bg-slate-900 dark:text-blue-300">
              {showMore ? "6位以降を閉じる ▲" : "6位以降を見る ▼"}
            </button>
            {showMore && (
              <div className="mt-2 space-y-2">
                {moreStocks.map((stock, index) => <CompactStockCard key={stock.code} stock={stock} rank={index + 6} />)}
              </div>
            )}
          </section>
        )}

        <details className="mt-4 rounded-2xl border border-slate-200 bg-white p-3 text-sm dark:border-slate-700 dark:bg-slate-900">
          <summary className="cursor-pointer font-bold text-slate-700 dark:text-slate-200">データの日時・ランキングの見方</summary>
          <div className="mt-2 space-y-1 text-xs leading-6 text-slate-600 dark:text-slate-300">
            <p>{displayLabels.description}</p>
            <p>株価基準日：{quoteDateRange.latest ?? "未確認"}。古いデータが混在する場合の最古日：{quoteDateRange.oldest ?? "未確認"}</p>
            <p>{marketClosed ? "分析保存" : "最終更新"}：{lastUpdated ? lastUpdated.toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" }) : "不明"}（日本時間）</p>
            <p>監視 {totalStocks || stocks.length} 銘柄、取得 {stocks.length} 件。順位は取得済み候補の範囲内で計算しています。</p>
            {savedDataView && <p className="font-bold text-amber-700 dark:text-amber-300">休場日または当日株価未確認のため、保存データを表示しています。</p>}
            <p>AI評価は過去の実測勝率ではなく、株価上昇や買い時を保証しません。購入前に当日のチャートと出来高をご確認ください。</p>
          </div>
        </details>

        <BottomNav />
      </div>
    </main>
  );
}

function CompactStockCard({ stock, rank }: { stock: Stock; rank: number }) {
  const reasons = reasonItems(stock);
  const changeTone = stock.changePercent > 0 ? "text-emerald-700 dark:text-emerald-400" :
    stock.changePercent < 0 ? "text-rose-600 dark:text-rose-400" : "text-slate-600 dark:text-slate-300";

  return (
    <article data-testid={rank === 1 ? "scan-mobile-top-pick" : undefined}
      className={"rounded-2xl border bg-white shadow-sm dark:bg-slate-900 " +
        (rank === 1 ? "border-amber-300 dark:border-amber-700" : "border-slate-200 dark:border-slate-700")}>
      <Link href={"/analysis/" + stock.code} aria-label={String(rank) + "位 " + stock.code + " " + stock.name + " の個別解析"}
        className="block rounded-2xl px-3.5 py-3.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500">
        <div className="flex items-center gap-2.5">
          <span className={"grid h-10 w-10 shrink-0 place-items-center rounded-xl text-base font-black " +
            (rank === 1 ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200" :
              rank <= 3 ? "bg-blue-50 text-blue-800 dark:bg-blue-950 dark:text-blue-200" :
                "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-100")}>
            {rank === 1 ? "🥇" : rank + "位"}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">{stock.code}</p>
            <h2 className="truncate text-base font-black leading-6">{stock.name}</h2>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">AI評価</p>
            <p data-testid={rank === 1 ? "scan-mobile-ai-power" : undefined} className="text-2xl font-black leading-7 tabular-nums text-blue-600 dark:text-blue-400">
              {scoreText(stock.score)}
            </p>
          </div>
        </div>
        <dl className="mt-2 grid grid-cols-3 gap-1 rounded-xl bg-slate-50 px-2 py-2.5 dark:bg-slate-800">
          <div className="min-w-0 text-center">
            <dt className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">参考株価</dt>
            <dd className="mt-0.5 truncate text-[13px] font-black tabular-nums">{yen(stock.price)}</dd>
          </div>
          <div className="min-w-0 border-x border-slate-200 text-center dark:border-slate-700">
            <dt className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">100株必要額</dt>
            <dd className="mt-0.5 truncate text-[13px] font-black tabular-nums">{yen(stock.price * 100)}</dd>
          </div>
          <div className="min-w-0 text-center">
            <dt className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">変化率</dt>
            <dd className={"mt-0.5 truncate text-[13px] font-black tabular-nums " + changeTone}>{changeText(stock.changePercent)}</dd>
          </div>
        </dl>
        <div className="mt-2 flex items-center justify-between gap-2">
          <p className="min-w-0 truncate text-xs text-slate-600 dark:text-slate-300">
            {reasons.length ? "✓ " + reasons.slice(0, 2).join(" / ") : "注目理由は個別解析で確認"}
          </p>
          <span className="shrink-0 text-xs font-bold text-blue-700 dark:text-blue-300">詳しく ›</span>
        </div>
      </Link>
    </article>
  );
}
