"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

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
  takeProfit?: number;
  stopLoss?: number;
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
};

type ScanResponse = {
  success?: boolean;
  totalStockList?: number;
  scannedCount?: number;
  stocks?: ApiStock[];
};

type PowerFilter = "all" | "95" | "85" | "70";
type BudgetFilter = "all" | "100000" | "300000" | "500000" | "1000000";
type SortKey = "score" | "change" | "price-low" | "volume";

const REFRESH_MS = 60_000;
const FETCH_TIMEOUT_MS = 30_000;

const POWER_OPTIONS: Array<{ value: PowerFilter; label: string }> = [
  { value: "all", label: "すべて" },
  { value: "95", label: "大本命" },
  { value: "85", label: "激熱以上" },
  { value: "70", label: "買い候補以上" },
];

const BUDGET_OPTIONS: Array<{ value: BudgetFilter; label: string }> = [
  { value: "all", label: "予算指定なし" },
  { value: "100000", label: "10万円以内" },
  { value: "300000", label: "30万円以内" },
  { value: "500000", label: "50万円以内" },
  { value: "1000000", label: "100万円以内" },
];

const SORT_OPTIONS: Array<{ value: SortKey; label: string }> = [
  { value: "score", label: "AI POWER順" },
  { value: "change", label: "上昇率順" },
  { value: "price-low", label: "必要資金が安い順" },
  { value: "volume", label: "出来高倍率順" },
];

function normalizeStocks(input: ApiStock[]): Stock[] {
  return input.map((stock) => ({
    code: String(stock.code ?? ""),
    name: String(stock.name ?? "名称不明"),
    price: Number(stock.price ?? stock.currentPrice ?? 0),
    changePercent: Number(stock.changePercent ?? 0),
    rsi: Number(stock.rsi ?? 0),
    volumeRatio: Number(stock.volumeRatio ?? 0),
    score: Number(stock.score ?? stock.aiPower ?? 0),
    reason: String(stock.reason ?? ""),
    patternSignal: String(stock.patternSignal ?? "NONE"),
    notificationLevel: String(stock.notificationLevel ?? ""),
    takeProfit:
      typeof stock.takeProfit === "number" ? stock.takeProfit : undefined,
    stopLoss: typeof stock.stopLoss === "number" ? stock.stopLoss : undefined,
  }));
}

function getSignal(score: number) {
  if (score >= 95) return "大本命";
  if (score >= 85) return "激熱";
  if (score >= 70) return "買い候補";
  if (score >= 50) return "静観";
  return "見送り";
}

function getSignalIcon(score: number) {
  if (score >= 95) return "👑";
  if (score >= 85) return "🔥";
  if (score >= 70) return "📈";
  if (score >= 50) return "👀";
  return "⏸️";
}

function getNotificationLevel(stock: Stock) {
  if (stock.notificationLevel) return stock.notificationLevel;
  if (stock.score >= 95) return "今すぐ確認";
  if (stock.score >= 85) return "激熱候補";
  if (stock.score >= 70) return "買い候補";
  return "監視";
}

function getSignalClasses(score: number) {
  if (score >= 95) {
    return {
      badge: "border-amber-200 bg-amber-50 text-amber-700",
      power: "from-amber-400 to-orange-500",
      ring: "ring-amber-100",
    };
  }
  if (score >= 85) {
    return {
      badge: "border-rose-200 bg-rose-50 text-rose-700",
      power: "from-rose-500 to-red-600",
      ring: "ring-rose-100",
    };
  }
  if (score >= 70) {
    return {
      badge: "border-blue-200 bg-blue-50 text-blue-700",
      power: "from-blue-500 to-indigo-600",
      ring: "ring-blue-100",
    };
  }
  return {
    badge: "border-slate-200 bg-slate-50 text-slate-600",
    power: "from-slate-500 to-slate-700",
    ring: "ring-slate-100",
  };
}

function formatPrice(value: number) {
  if (!Number.isFinite(value) || value <= 0) return "-";
  return `${Math.round(value).toLocaleString("ja-JP")}円`;
}

function formatPercent(value: number) {
  if (!Number.isFinite(value)) return "-";
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}

function formatUpdatedAt(value: Date | null) {
  if (!value) return "未取得";
  return value.toLocaleTimeString("ja-JP", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function ScanPage() {
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorText, setErrorText] = useState("");
  const [totalStockList, setTotalStockList] = useState(0);
  const [scannedCount, setScannedCount] = useState(0);
  const [alerts, setAlerts] = useState<string[]>([]);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [query, setQuery] = useState("");
  const [powerFilter, setPowerFilter] = useState<PowerFilter>("all");
  const [budgetFilter, setBudgetFilter] = useState<BudgetFilter>("all");
  const [sortKey, setSortKey] = useState<SortKey>("score");
  const [filtersOpen, setFiltersOpen] = useState(false);

  const fetchStocks = useCallback(async (manual = false) => {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(
      () => controller.abort(),
      FETCH_TIMEOUT_MS,
    );

    try {
      if (manual) setRefreshing(true);
      setErrorText("");

      const res = await fetch("/api/scan?limit=100&top=100", {
        cache: "no-store",
        signal: controller.signal,
      });

      if (!res.ok) {
        throw new Error(`scan api error: ${res.status}`);
      }

      const data: ScanResponse | ApiStock[] = await res.json();
      const rawStocks = Array.isArray(data)
        ? data
        : Array.isArray(data?.stocks)
          ? data.stocks
          : [];
      const normalized = normalizeStocks(rawStocks);

      setStocks(normalized);
      setUpdatedAt(new Date());

      if (!Array.isArray(data)) {
        setTotalStockList(Number(data.totalStockList ?? normalized.length));
        setScannedCount(Number(data.scannedCount ?? normalized.length));
      } else {
        setTotalStockList(normalized.length);
        setScannedCount(normalized.length);
      }

      const now = new Date().toLocaleTimeString("ja-JP", {
        hour: "2-digit",
        minute: "2-digit",
      });
      const newAlerts = normalized
        .filter((stock) => stock.score >= 95)
        .slice(0, 5)
        .map((stock) => `${now} ${stock.code} ${stock.name} AI ${stock.score}`);

      if (newAlerts.length > 0) {
        setAlerts((prev) =>
          Array.from(new Set([...newAlerts, ...prev])).slice(0, 10),
        );
      }
    } catch (error) {
      const message =
        error instanceof Error && error.name === "AbortError"
          ? "スキャンAPIがタイムアウトしました。少し待って再読み込みしてください。"
          : "スキャンデータを取得できませんでした。";

      console.error("scan fetch error:", error);
      setErrorText(message);
    } finally {
      window.clearTimeout(timeoutId);
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void fetchStocks();
    const intervalId = window.setInterval(() => {
      void fetchStocks();
    }, REFRESH_MS);
    return () => window.clearInterval(intervalId);
  }, [fetchStocks]);

  const stats = useMemo(() => {
    const favorite = stocks.filter((stock) => stock.score >= 95).length;
    const hot = stocks.filter(
      (stock) => stock.score >= 85 && stock.score < 95,
    ).length;
    const strong = stocks.filter(
      (stock) => stock.score >= 70 && stock.score < 85,
    ).length;
    const average =
      stocks.length > 0
        ? Math.round(
            stocks.reduce((sum, stock) => sum + stock.score, 0) / stocks.length,
          )
        : 0;

    return { favorite, hot, strong, average };
  }, [stocks]);

  const filteredStocks = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const minimumScore = powerFilter === "all" ? 0 : Number(powerFilter);
    const budget = budgetFilter === "all" ? Infinity : Number(budgetFilter);

    return stocks
      .filter((stock) => {
        const matchesQuery =
          !normalizedQuery ||
          stock.code.toLowerCase().includes(normalizedQuery) ||
          stock.name.toLowerCase().includes(normalizedQuery);
        const matchesPower = stock.score >= minimumScore;
        const requiredCapital = stock.price > 0 ? stock.price * 100 : Infinity;
        const matchesBudget = requiredCapital <= budget;
        return matchesQuery && matchesPower && matchesBudget;
      })
      .sort((a, b) => {
        if (sortKey === "change") return b.changePercent - a.changePercent;
        if (sortKey === "price-low") return a.price - b.price;
        if (sortKey === "volume") return b.volumeRatio - a.volumeRatio;
        return b.score - a.score;
      });
  }, [budgetFilter, powerFilter, query, sortKey, stocks]);

  const clearFilters = () => {
    setQuery("");
    setPowerFilter("all");
    setBudgetFilter("all");
    setSortKey("score");
  };

  return (
    <main className="min-h-screen bg-[#f5f7fb] pb-28 text-slate-900">
      <div className="mx-auto w-full max-w-6xl px-4 py-5 sm:px-6 lg:px-8">
        <header className="overflow-hidden rounded-[28px] border border-white bg-gradient-to-br from-[#071a3d] via-[#0b2b62] to-[#1265d8] px-5 py-6 text-white shadow-[0_20px_55px_rgba(15,42,92,0.24)] sm:px-7 sm:py-8">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <Link
                href="/dashboard"
                className="mb-4 inline-flex items-center gap-2 text-xs font-extrabold text-blue-100 transition hover:text-white"
              >
                <span aria-hidden>←</span>
                Dashboard
              </Link>
              <p className="text-xs font-black tracking-[0.2em] text-blue-200">
                SIGNALX AI SCAN
              </p>
              <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">
                全銘柄スキャン
              </h1>
              <p className="mt-3 max-w-xl text-sm font-medium leading-6 text-blue-100">
                AIが日本株を監視し、今チェックしたい銘柄を優先順に表示します。
              </p>
            </div>

            <button
              type="button"
              onClick={() => void fetchStocks(true)}
              disabled={refreshing}
              className="inline-flex shrink-0 items-center gap-2 rounded-2xl border border-white/20 bg-white/10 px-3 py-3 text-xs font-black backdrop-blur transition hover:bg-white/20 disabled:cursor-wait disabled:opacity-60 sm:px-4"
            >
              <span className={refreshing ? "animate-spin" : ""}>↻</span>
              <span className="hidden sm:inline">
                {refreshing ? "更新中" : "再読み込み"}
              </span>
            </button>
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-2 text-[11px] font-bold text-blue-100">
            <span className="rounded-full bg-white/10 px-3 py-2">
              監視 {totalStockList.toLocaleString()}銘柄
            </span>
            <span className="rounded-full bg-white/10 px-3 py-2">
              取得済み {scannedCount.toLocaleString()}銘柄
            </span>
            <span className="rounded-full bg-white/10 px-3 py-2">
              最終更新 {formatUpdatedAt(updatedAt)}
            </span>
          </div>
        </header>

        <section className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <SummaryCard
            icon="👑"
            label="大本命"
            value={stats.favorite}
            note="AI 95以上"
          />
          <SummaryCard
            icon="🔥"
            label="激熱"
            value={stats.hot}
            note="AI 85〜94"
          />
          <SummaryCard
            icon="📈"
            label="買い候補"
            value={stats.strong}
            note="AI 70〜84"
          />
          <SummaryCard
            icon="🧠"
            label="平均AI"
            value={stats.average}
            note="上位100銘柄"
          />
        </section>

        <section className="mt-5 rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-black">銘柄を絞り込む</h2>
              <p className="mt-1 text-xs font-medium text-slate-500">
                銘柄名・コード・AI POWER・予算から検索できます。
              </p>
            </div>
            <button
              type="button"
              onClick={() => setFiltersOpen((prev) => !prev)}
              className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-black text-slate-700 sm:hidden"
            >
              {filtersOpen ? "閉じる" : "条件変更"}
            </button>
          </div>

          <div className="mt-4">
            <label className="relative block">
              <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-slate-400">
                ⌕
              </span>
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="銘柄名またはコードで検索"
                className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 pl-11 pr-4 text-sm font-bold outline-none transition placeholder:font-medium placeholder:text-slate-400 focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-50"
              />
            </label>
          </div>

          <div
            className={`${filtersOpen ? "grid" : "hidden"} mt-4 gap-3 sm:grid sm:grid-cols-3`}
          >
            <FilterSelect
              label="AI POWER"
              value={powerFilter}
              onChange={(value) => setPowerFilter(value as PowerFilter)}
              options={POWER_OPTIONS}
            />
            <FilterSelect
              label="予算（100株）"
              value={budgetFilter}
              onChange={(value) => setBudgetFilter(value as BudgetFilter)}
              options={BUDGET_OPTIONS}
            />
            <FilterSelect
              label="並び替え"
              value={sortKey}
              onChange={(value) => setSortKey(value as SortKey)}
              options={SORT_OPTIONS}
            />
          </div>

          <div className="mt-4 flex items-center justify-between gap-3 border-t border-slate-100 pt-4">
            <p className="text-xs font-bold text-slate-500">
              条件に一致：
              <span className="ml-1 text-base font-black text-blue-700">
                {filteredStocks.length}
              </span>
              件
            </p>
            <button
              type="button"
              onClick={clearFilters}
              className="text-xs font-black text-slate-500 underline decoration-slate-300 underline-offset-4 hover:text-blue-700"
            >
              条件をリセット
            </button>
          </div>
        </section>

        {loading && <LoadingCards />}

        {!loading && errorText && (
          <section className="mt-5 rounded-[24px] border border-red-200 bg-white p-6 text-center shadow-sm">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-xl">
              !
            </div>
            <h2 className="mt-4 text-base font-black text-red-700">
              データを読み込めませんでした
            </h2>
            <p className="mt-2 text-sm font-medium text-slate-500">
              {errorText}
            </p>
            <button
              type="button"
              onClick={() => void fetchStocks(true)}
              className="mt-5 rounded-2xl bg-blue-600 px-5 py-3 text-sm font-black text-white shadow-lg shadow-blue-200 transition hover:bg-blue-700"
            >
              もう一度読み込む
            </button>
          </section>
        )}

        {!loading && !errorText && filteredStocks.length === 0 && (
          <section className="mt-5 rounded-[24px] border border-slate-200 bg-white p-8 text-center shadow-sm">
            <div className="text-3xl">🔎</div>
            <h2 className="mt-3 text-lg font-black">
              該当する銘柄がありません
            </h2>
            <p className="mt-2 text-sm font-medium text-slate-500">
              検索条件を少し広げて、もう一度確認してください。
            </p>
          </section>
        )}

        {!loading && !errorText && filteredStocks.length > 0 && (
          <>
            <section className="mt-5 space-y-3 lg:hidden">
              {filteredStocks.map((stock, index) => (
                <StockCard key={stock.code} stock={stock} rank={index + 1} />
              ))}
            </section>

            <section className="mt-5 hidden overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-sm lg:block">
              <div className="border-b border-slate-100 px-6 py-5">
                <h2 className="text-lg font-black">AI POWERランキング</h2>
                <p className="mt-1 text-xs font-medium text-slate-500">
                  上位銘柄の主要指標を一覧で比較できます。
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[980px]">
                  <thead className="bg-slate-50 text-left text-xs font-black text-slate-500">
                    <tr>
                      <th className="px-5 py-4">順位</th>
                      <th className="px-5 py-4">銘柄</th>
                      <th className="px-5 py-4">AI POWER</th>
                      <th className="px-5 py-4">株価</th>
                      <th className="px-5 py-4">前日比</th>
                      <th className="px-5 py-4">RSI</th>
                      <th className="px-5 py-4">出来高</th>
                      <th className="px-5 py-4">必要資金</th>
                      <th className="px-5 py-4">詳細</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredStocks.map((stock, index) => (
                      <StockTableRow
                        key={stock.code}
                        stock={stock}
                        rank={index + 1}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}

        <aside className="mt-5 rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-black">🔥 シグナルアラート</h2>
              <p className="mt-1 text-xs font-medium text-slate-500">
                AI POWER 95以上の最新候補です。
              </p>
            </div>
            <span className="rounded-full bg-red-50 px-3 py-1 text-xs font-black text-red-600">
              {alerts.length}件
            </span>
          </div>

          <div className="mt-4 space-y-2">
            {alerts.length === 0 ? (
              <div className="rounded-2xl bg-slate-50 px-4 py-5 text-center text-sm font-bold text-slate-500">
                現在、新しい大本命通知はありません。
              </div>
            ) : (
              alerts.map((alert, index) => (
                <p
                  key={`${alert}-${index}`}
                  className="rounded-2xl border border-red-100 bg-red-50/70 px-4 py-3 text-sm font-bold text-red-700"
                >
                  {alert}
                </p>
              ))
            )}
          </div>
        </aside>
      </div>

      <BottomNavigation />
    </main>
  );
}

function SummaryCard({
  icon,
  label,
  value,
  note,
}: {
  icon: string;
  label: string;
  value: number;
  note: string;
}) {
  return (
    <div className="rounded-[22px] border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-50 text-lg">
          {icon}
        </div>
        <span className="text-[10px] font-black text-slate-400">LIVE</span>
      </div>
      <p className="mt-4 text-xs font-black text-slate-500">{label}</p>
      <p className="mt-1 text-3xl font-black tracking-tight text-slate-950">
        {value.toLocaleString("ja-JP")}
      </p>
      <p className="mt-1 text-[11px] font-bold text-slate-400">{note}</p>
    </div>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-[11px] font-black text-slate-500">
        {label}
      </span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-12 w-full appearance-none rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-black text-slate-800 outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-50"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function StockCard({ stock, rank }: { stock: Stock; rank: number }) {
  const signal = getSignal(stock.score);
  const notification = getNotificationLevel(stock);
  const styles = getSignalClasses(stock.score);
  const requiredCapital = stock.price > 0 ? stock.price * 100 : 0;

  return (
    <article
      className={`rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm ring-4 ${styles.ring}`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex h-8 min-w-8 items-center justify-center rounded-xl bg-slate-100 px-2 text-xs font-black text-slate-600">
              {rank}
            </span>
            <span className="text-xs font-black tracking-wide text-slate-400">
              {stock.code}
            </span>
            <span
              className={`rounded-full border px-2.5 py-1 text-[11px] font-black ${styles.badge}`}
            >
              {getSignalIcon(stock.score)} {signal}
            </span>
          </div>
          <h2 className="mt-3 truncate text-lg font-black text-slate-950">
            {stock.name}
          </h2>
          <p className="mt-1 text-xs font-bold text-slate-400">
            {notification}
          </p>
        </div>

        <div
          className={`flex h-[76px] w-[76px] shrink-0 flex-col items-center justify-center rounded-[22px] bg-gradient-to-br ${styles.power} text-white shadow-lg`}
        >
          <span className="text-[9px] font-black tracking-[0.16em]">
            AI POWER
          </span>
          <strong className="mt-1 text-3xl font-black leading-none">
            {Math.round(stock.score)}
          </strong>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <Metric label="現在値" value={formatPrice(stock.price)} />
        <Metric
          label="前日比"
          value={formatPercent(stock.changePercent)}
          valueClass={
            stock.changePercent >= 0 ? "text-emerald-600" : "text-red-600"
          }
        />
        <Metric label="RSI" value={stock.rsi ? stock.rsi.toFixed(0) : "-"} />
        <Metric
          label="出来高"
          value={stock.volumeRatio ? `${stock.volumeRatio.toFixed(2)}倍` : "-"}
        />
      </div>

      <div className="mt-3 rounded-2xl bg-slate-50 px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs font-bold text-slate-500">
            100株の必要資金
          </span>
          <strong className="text-sm font-black text-slate-900">
            {requiredCapital > 0 ? formatPrice(requiredCapital) : "-"}
          </strong>
        </div>
      </div>

      {stock.reason && (
        <p className="mt-3 line-clamp-2 text-xs font-medium leading-5 text-slate-500">
          {stock.reason}
        </p>
      )}

      <Link
        href={`/analysis/${stock.code}`}
        className="mt-4 flex h-12 items-center justify-center gap-2 rounded-2xl bg-blue-600 px-4 text-sm font-black text-white shadow-lg shadow-blue-200 transition hover:-translate-y-0.5 hover:bg-blue-700"
      >
        AI分析を見る
        <span aria-hidden>→</span>
      </Link>
    </article>
  );
}

function StockTableRow({ stock, rank }: { stock: Stock; rank: number }) {
  const signal = getSignal(stock.score);
  const styles = getSignalClasses(stock.score);
  const requiredCapital = stock.price > 0 ? stock.price * 100 : 0;

  return (
    <tr className="transition hover:bg-blue-50/40">
      <td className="px-5 py-4 text-sm font-black text-slate-500">{rank}</td>
      <td className="px-5 py-4">
        <div className="font-black text-slate-950">{stock.name}</div>
        <div className="mt-1 text-xs font-bold text-slate-400">
          {stock.code}
        </div>
      </td>
      <td className="px-5 py-4">
        <div className="flex items-center gap-2">
          <span className="text-xl font-black text-blue-700">
            {stock.score}
          </span>
          <span
            className={`rounded-full border px-2.5 py-1 text-[10px] font-black ${styles.badge}`}
          >
            {getSignalIcon(stock.score)} {signal}
          </span>
        </div>
      </td>
      <td className="px-5 py-4 text-sm font-bold">
        {formatPrice(stock.price)}
      </td>
      <td
        className={`px-5 py-4 text-sm font-black ${stock.changePercent >= 0 ? "text-emerald-600" : "text-red-600"}`}
      >
        {formatPercent(stock.changePercent)}
      </td>
      <td className="px-5 py-4 text-sm font-bold">
        {stock.rsi ? stock.rsi.toFixed(0) : "-"}
      </td>
      <td className="px-5 py-4 text-sm font-bold">
        {stock.volumeRatio ? `${stock.volumeRatio.toFixed(2)}倍` : "-"}
      </td>
      <td className="px-5 py-4 text-sm font-bold">
        {requiredCapital > 0 ? formatPrice(requiredCapital) : "-"}
      </td>
      <td className="px-5 py-4">
        <Link
          href={`/analysis/${stock.code}`}
          className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-black text-white shadow-md shadow-blue-100 transition hover:bg-blue-700"
        >
          AI分析
          <span aria-hidden>→</span>
        </Link>
      </td>
    </tr>
  );
}

function Metric({
  label,
  value,
  valueClass = "text-slate-900",
}: {
  label: string;
  value: string;
  valueClass?: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-slate-50 px-3 py-3">
      <p className="text-[10px] font-black text-slate-400">{label}</p>
      <p className={`mt-1 text-sm font-black ${valueClass}`}>{value}</p>
    </div>
  );
}

function LoadingCards() {
  return (
    <section className="mt-5 space-y-3 lg:grid lg:grid-cols-2 lg:gap-4 lg:space-y-0">
      {Array.from({ length: 6 }).map((_, index) => (
        <div
          key={index}
          className="animate-pulse rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm"
        >
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <div className="h-4 w-24 rounded bg-slate-200" />
              <div className="mt-3 h-6 w-2/3 rounded bg-slate-200" />
              <div className="mt-2 h-3 w-20 rounded bg-slate-100" />
            </div>
            <div className="h-[76px] w-[76px] rounded-[22px] bg-slate-200" />
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2">
            {Array.from({ length: 4 }).map((__, metricIndex) => (
              <div
                key={metricIndex}
                className="h-16 rounded-2xl bg-slate-100"
              />
            ))}
          </div>
          <div className="mt-4 h-12 rounded-2xl bg-slate-200" />
        </div>
      ))}
    </section>
  );
}

function BottomNavigation() {
  const items = [
    { href: "/", icon: "⌂", label: "Home" },
    { href: "/scan-mobile", icon: "⌕", label: "Scan", active: true },
    { href: "/performance", icon: "↗", label: "実績" },
    { href: "/learning", icon: "◈", label: "学習" },
    { href: "/mypage", icon: "●", label: "マイページ" },
  ];

  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-slate-200 bg-white/95 px-2 pb-[max(8px,env(safe-area-inset-bottom))] pt-2 shadow-[0_-10px_35px_rgba(15,23,42,0.08)] backdrop-blur lg:hidden">
      <div className="mx-auto grid max-w-md grid-cols-5">
        {items.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`flex flex-col items-center justify-center gap-1 rounded-2xl px-1 py-2 text-[10px] font-black transition ${
              item.active
                ? "bg-blue-50 text-blue-700"
                : "text-slate-400 hover:text-slate-700"
            }`}
          >
            <span className="text-lg leading-none">{item.icon}</span>
            <span>{item.label}</span>
          </Link>
        ))}
      </div>
    </nav>
  );
}