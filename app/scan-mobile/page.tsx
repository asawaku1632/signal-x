"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";

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
};

type SignalFilter = "hot" | "strong" | "all";
type BudgetFilter = 10000 | 100000 | 300000 | 500000 | 1000000 | "all";
type SortMode = "score" | "change" | "down" | "cheap" | "expensive" | "money";

const budgetOptions: { label: string; value: BudgetFilter }[] = [
  { label: "1万", value: 10000 },
  { label: "10万", value: 100000 },
  { label: "30万", value: 300000 },
  { label: "50万", value: 500000 },
  { label: "100万", value: 1000000 },
  { label: "制限なし", value: "all" },
];

const HOT_TOP_LIMIT = 3;
const STRONG_TOP_LIMIT = 10;

const sortOptions: { label: string; value: SortMode }[] = [
  { label: "🔥 AI POWER順", value: "score" },
  { label: "📈 上昇率順", value: "change" },
  { label: "📉 下落率順", value: "down" },
  { label: "🏦 必要資金順", value: "money" },
  { label: "💴 株価安い順", value: "cheap" },
  { label: "💰 株価高い順", value: "expensive" },
];

function yen(value?: number | null) {
  if (value === undefined || value === null || Number.isNaN(value)) return "-";
  return `${Math.round(value).toLocaleString()}円`;
}

function budgetLabel(value: BudgetFilter) {
  if (value === "all") return "制限なし";
  return `${Math.round(value / 10000)}万円以内`;
}

function judgeLabel(score: number) {
  if (score >= 95) return "👑 Sランク";
  if (score >= 85) return "🔥 激熱";
  if (score >= 70) return "🟢 強い";
  if (score >= 50) return "🟡 静観";
  return "🔴 見送り";
}

function judgeColor(score: number) {
  if (score >= 95) return "text-yellow-500";
  if (score >= 85) return "text-red-500";
  if (score >= 70) return "text-emerald-600";
  if (score >= 50) return "text-yellow-600";
  return "text-slate-500";
}

function judgeBg(score: number) {
  if (score >= 95) return "bg-yellow-50 border-yellow-200";
  if (score >= 85) return "bg-red-50 border-red-200";
  if (score >= 70) return "bg-emerald-50 border-emerald-200";
  if (score >= 50) return "bg-yellow-50 border-yellow-200";
  return "bg-slate-50 border-slate-200";
}

function getPatternText(pattern?: string) {
  if (pattern === "W_BOTTOM_BREAK") return "Wボトム突破";
  if (pattern === "W_BOTTOM") return "Wボトム候補";
  return "通常";
}

function getMarketJudge(hot: number, strong: number) {
  if (hot >= 80) return "🔥 超強気";
  if (hot >= 30) return "🟢 強気";
  if (hot >= 10) return "🟡 やや強気";
  if (strong >= 30) return "⚪ 厳選";
  return "🔵 静観";
}

function getMarketComment(hot: number, strong: number) {
  if (hot >= 80) {
    return "市場全体が非常に強い状態です。Sランク銘柄を積極的に狙える一日です。";
  }

  if (hot >= 30) {
    return "今日は攻められる相場です。Sランク・Aランクを中心に監視しましょう。";
  }

  if (hot >= 10) {
    return "強い銘柄はありますが、飛び乗りは避けて条件を確認してから入りましょう。";
  }

  if (strong >= 30) {
    return "本命候補はあります。焦らず条件の整った銘柄だけを選びたい相場です。";
  }

  return "今日は無理に売買せず、様子見を優先したい相場です。";
}

function getAiAdvice(score: number) {
  if (score >= 95) return "最優先で監視したい大本命候補です。";
  if (score >= 85) return "勢いが強い銘柄です。条件確認後に注目です。";
  if (score >= 70) return "本命候補です。押し目や出来高を確認しましょう。";
  if (score >= 50) return "今は静観寄り。無理に入らず確認優先です。";
  return "今日は見送り候補です。";
}

export default function ScanMobilePage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-[#f7f9fc] p-5 text-slate-900">
          <div className="mx-auto max-w-md rounded-[2rem] bg-white p-6 text-center shadow-sm">
            <p className="text-2xl font-black">読み込み中...</p>
            <p className="mt-2 text-sm font-bold text-slate-500">
              SIGNALXのAIスキャンを準備しています。
            </p>
          </div>
        </main>
      }
    >
      <ScanMobileContent />
    </Suspense>
  );
}
function ScanMobileContent() {
  const searchParams = useSearchParams();

  const [stocks, setStocks] = useState<Stock[]>([]);
  const [totalStocks, setTotalStocks] = useState(0);
  const [loading, setLoading] = useState(true);
  const [signalFilter, setSignalFilter] = useState<SignalFilter>("strong");

  const budgetParam = searchParams.get("budget");

  const initialBudget: BudgetFilter =
    budgetParam === "all"
      ? "all"
      : ((Number(budgetParam) || 100000) as BudgetFilter);

  const [budgetFilter, setBudgetFilter] = useState<BudgetFilter>(initialBudget);

  const [sortMode, setSortMode] = useState<SortMode>("score");

  const rankingRef = useRef<HTMLDivElement>(null);
  const fetchingRef = useRef(false);

  const scrollToRanking = () => {
    rankingRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  };

  async function fetchStocks() {
    if (fetchingRef.current) return;

    fetchingRef.current = true;

    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 90_000);

    try {
      setLoading(stocks.length === 0);

      const res = await fetch("/api/scan?limit=1200&top=100", {
        cache: "no-store",
        signal: controller.signal,
      });

      if (!res.ok) {
        throw new Error(`scan api error: ${res.status}`);
      }

      const json = await res.json();

      const list: Stock[] = Array.isArray(json)
        ? json
        : Array.isArray(json?.stocks)
          ? json.stocks
          : [];

      if (list.length === 0) {
        throw new Error("scan api returned empty stocks");
      }

      setStocks(list);
      setTotalStocks(Number(json?.totalStockList ?? list.length));
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        console.warn("scan-mobile fetch timeout");
      } else {
        console.error("scan-mobile fetch error:", error);
      }

      // 一時的な通信失敗では、前回取得済みの正常データを維持する
    } finally {
      window.clearTimeout(timeoutId);
      fetchingRef.current = false;
      setLoading(false);
    }
  }

  async function addFavorite(code: string, name: string) {
    try {
      await fetch("/api/favorites", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          code,
          name,
        }),
      });

      alert(`${name} をお気に入り登録しました⭐`);
    } catch (error) {
      console.error(error);
    }
  }

  useEffect(() => {
    fetchStocks();

    const timer = setInterval(fetchStocks, 60000);

    return () => clearInterval(timer);
  }, []);

  const rankedStocks = useMemo(
    () =>
      [...stocks].sort((a, b) => {
        if (b.score !== a.score) {
          return b.score - a.score;
        }

        if (b.changePercent !== a.changePercent) {
          return b.changePercent - a.changePercent;
        }

        if (b.volumeRatio !== a.volumeRatio) {
          return b.volumeRatio - a.volumeRatio;
        }

        return a.code.localeCompare(b.code, "ja", { numeric: true });
      }),
    [stocks],
  );

  const hotSignals = useMemo(
    () => rankedStocks.slice(0, HOT_TOP_LIMIT),
    [rankedStocks],
  );

  const strongSignals = useMemo(
    () => rankedStocks.slice(0, STRONG_TOP_LIMIT),
    [rankedStocks],
  );

  const hotSignalCodes = useMemo(
    () => new Set(hotSignals.map((stock) => stock.code)),
    [hotSignals],
  );

  const strongSignalCodes = useMemo(
    () => new Set(strongSignals.map((stock) => stock.code)),
    [strongSignals],
  );

  const rawHotCount = useMemo(
    () => stocks.filter((stock) => stock.score >= 95).length,
    [stocks],
  );

  const rawStrongCount = useMemo(
    () => stocks.filter((stock) => stock.score >= 85).length,
    [stocks],
  );

  const filteredStocks = useMemo(() => {
    const result = stocks.filter((stock) => {
      const requiredMoney = stock.price * 100;

      const signalOk =
        signalFilter === "hot"
          ? hotSignalCodes.has(stock.code)
          : signalFilter === "strong"
            ? strongSignalCodes.has(stock.code)
            : true;

      const budgetOk =
        budgetFilter === "all" ? true : requiredMoney <= budgetFilter;

      return signalOk && budgetOk;
    });

    if (sortMode === "score") {
      result.sort((a, b) => b.score - a.score);
    }

    if (sortMode === "change") {
      result.sort((a, b) => b.changePercent - a.changePercent);
    }

    if (sortMode === "down") {
      result.sort((a, b) => a.changePercent - b.changePercent);
    }

    if (sortMode === "cheap") {
      result.sort((a, b) => a.price - b.price);
    }

    if (sortMode === "expensive") {
      result.sort((a, b) => b.price - a.price);
    }

    if (sortMode === "money") {
      result.sort((a, b) => a.price * 100 - b.price * 100);
    }

    return result;
  }, [
    stocks,
    signalFilter,
    budgetFilter,
    sortMode,
    hotSignalCodes,
    strongSignalCodes,
  ]);

  const bestSignal = filteredStocks[0];

  const hotTop3 = useMemo(() => hotSignals.slice(0, 3), [hotSignals]);

  const marketJudge = getMarketJudge(rawHotCount, rawStrongCount);
  const marketComment =
    "AIが今日の注目銘柄を優先順位付きで選出しました。まずはTOP3から確認しましょう。";

  const winRate = bestSignal
    ? Math.min(95, Math.max(45, Math.round(bestSignal.score * 0.75 + 12)))
    : 0;

  const takeProfit = bestSignal
    ? (bestSignal.takeProfit ?? Math.round(bestSignal.price * 1.03))
    : 0;

  const stopLoss = bestSignal
    ? (bestSignal.stopLoss ?? Math.round(bestSignal.price * 0.98))
    : 0;

  const expectedProfit = bestSignal ? (takeProfit - bestSignal.price) * 100 : 0;

  const riskRewardRatio = bestSignal
    ? Number(
        (
          (takeProfit - bestSignal.price) /
          Math.max(bestSignal.price - stopLoss, 1)
        ).toFixed(1),
      )
    : 0;

  return (
    <main className="min-h-screen bg-[#f7f9fc] pb-28 text-slate-900">
      <div className="mx-auto max-w-md px-4 pt-5">
        <header className="sticky top-0 z-30 -mx-4 border-b border-white/70 bg-[#f7f9fc]/85 px-4 pb-3 pt-3 backdrop-blur-xl">
          <div className="flex items-center justify-between">
            <Link href="/" className="flex items-center gap-3">
              <div className="grid h-11 w-11 place-items-center rounded-2xl bg-blue-600 text-lg font-black text-white shadow-lg shadow-blue-200">
                X
              </div>

              <div>
                <h1 className="text-3xl font-black tracking-tight">
                  SIGNAL<span className="text-blue-600">X</span>
                </h1>
                <p className="text-[10px] font-black tracking-[0.22em] text-slate-500">
                  AI STOCK SCAN
                </p>
              </div>
            </Link>

            <button
              onClick={fetchStocks}
              className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-xl shadow-sm transition active:scale-95"
              aria-label="再読み込み"
            >
              🔄
            </button>
          </div>
        </header>
        {/* COMPACT LIVE SCAN */}
        <section className="mt-4 overflow-hidden rounded-3xl bg-gradient-to-r from-slate-950 via-blue-950 to-blue-700 px-4 py-3 text-white shadow-lg shadow-blue-100">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 shrink-0 animate-pulse rounded-full bg-emerald-400" />
                <p className="text-xs font-black tracking-[0.16em] text-blue-100">
                  LIVE SCAN
                </p>
              </div>

              <div className="mt-2 flex items-center gap-3 text-[11px] font-black text-blue-100">
                <span>監視 {totalStocks.toLocaleString()}</span>
                <span>取得 {stocks.length.toLocaleString()}</span>
                <span>激熱 TOP{HOT_TOP_LIMIT}</span>
              </div>
            </div>

            <div className="shrink-0 rounded-2xl bg-white/10 px-3 py-2 text-center backdrop-blur">
              <p className="text-[10px] font-black text-blue-100">自動更新</p>
              <p className="text-sm font-black">60秒</p>
            </div>
          </div>
        </section>

        {/* MARKET JUDGE - COMPACT */}
        <section className="mt-4 rounded-3xl border border-white bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[10px] font-black tracking-[0.18em] text-blue-600">
                MARKET JUDGE
              </p>
              <h2 className="mt-1 text-xl font-black">AI判定 {marketJudge}</h2>
              <p className="mt-1 line-clamp-1 text-[11px] font-bold text-slate-500">
                {marketComment}
              </p>
            </div>

          </div>

          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              onClick={() => {
                setSignalFilter("hot");
                setTimeout(scrollToRanking, 100);
              }}
              className={`rounded-2xl border px-3 py-2.5 text-left transition active:scale-95 ${
                signalFilter === "hot"
                  ? "border-red-300 bg-red-50"
                  : "border-slate-200 bg-slate-50"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-[10px] font-black text-red-500">
                  今日の激熱
                </p>
                <p className="text-lg font-black text-red-500">
                  TOP{HOT_TOP_LIMIT}
                </p>
              </div>
            </button>

            <button
              onClick={() => {
                setSignalFilter("strong");
                setTimeout(scrollToRanking, 100);
              }}
              className={`rounded-2xl border px-3 py-2.5 text-left transition active:scale-95 ${
                signalFilter === "strong"
                  ? "border-blue-300 bg-blue-50"
                  : "border-slate-200 bg-slate-50"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-[10px] font-black text-blue-500">本命候補</p>
                <p className="text-lg font-black text-blue-600">
                  TOP{STRONG_TOP_LIMIT}
                </p>
              </div>
            </button>
          </div>
        </section>

        {/* CURRENT BUDGET */}
        {budgetFilter !== "all" && (
          <section className="mt-4 rounded-3xl border border-emerald-200 bg-gradient-to-r from-emerald-50 to-green-100 px-4 py-3 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-black tracking-wider text-emerald-700">
                  💴 現在の予算
                </p>
                <h2 className="mt-1 text-2xl font-black text-emerald-700">
                  {budgetLabel(budgetFilter)}
                </h2>
              </div>
              <p className="max-w-[150px] text-right text-[10px] font-bold leading-4 text-slate-600">
                100株購入できる銘柄だけを表示
              </p>
            </div>
          </section>
        )}

        {/* FILTERS */}
        <section className="mt-5 rounded-[2rem] border border-white bg-white p-5 shadow-sm">
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="text-xs font-black tracking-[0.18em] text-blue-600">
                FILTER
              </p>

              <h2 className="mt-2 text-2xl font-black">予算フィルター</h2>
            </div>

            <p className="rounded-full bg-emerald-50 px-3 py-2 text-xs font-black text-emerald-700">
              {budgetLabel(budgetFilter)}
            </p>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-2">
            {budgetOptions.map((item) => (
              <ChipButton
                key={item.label}
                active={budgetFilter === item.value}
                label={item.label}
                onClick={() => {
                  setBudgetFilter(item.value);
                  setTimeout(scrollToRanking, 100);
                }}
              />
            ))}
          </div>
        </section>

        <section className="mt-5 rounded-[2rem] border border-white bg-white p-5 shadow-sm">
          <div>
            <p className="text-xs font-black tracking-[0.18em] text-blue-600">
              SORT
            </p>

            <h2 className="mt-2 text-2xl font-black">並び替え</h2>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2">
            {sortOptions.map((item) => (
              <ChipButton
                key={item.value}
                active={sortMode === item.value}
                label={item.label}
                onClick={() => setSortMode(item.value)}
              />
            ))}
          </div>
        </section>

        {/* BEST SIGNAL */}
        {bestSignal && (
          <section className="mt-5 overflow-hidden rounded-[2rem] bg-gradient-to-br from-blue-600 via-indigo-700 to-slate-950 p-4 text-white shadow-xl shadow-blue-200">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-black tracking-[0.18em] text-blue-100">
                  BEST SIGNAL
                </p>

                <p className="mt-2 text-xs font-black text-blue-100">
                  👑 本日の大本命
                </p>

                <h2 className="mt-1 text-4xl font-black">{bestSignal.code}</h2>

                <p className="mt-1 text-xl font-black">{bestSignal.name}</p>
              </div>

              <div className="rounded-2xl bg-white/10 px-3 py-2 text-center backdrop-blur">
                <p className="text-xs font-black text-blue-100">AI POWER</p>
                <p className="mt-1 text-4xl font-black">{bestSignal.score}</p>
              </div>
            </div>

            <p className="mt-3 line-clamp-2 text-xs font-bold leading-5 text-blue-100">
              {bestSignal.reason || "AI理由なし"}
            </p>

            <div className="mt-3 grid grid-cols-3 gap-2">
              <GlassMini label="AI勝率" value={`${winRate}%`} />
              <GlassMini label="RR比" value={`${riskRewardRatio}`} />
              <GlassMini label="期待利益" value={`+${yen(expectedProfit)}`} />
              <GlassMini label="必要資金" value={yen(bestSignal.price * 100)} />
              <GlassMini label="利確" value={yen(takeProfit)} />
              <GlassMini label="損切" value={yen(stopLoss)} />
            </div>

            <Link
              href={`/analysis/${bestSignal.code}`}
              className="mt-3 block rounded-2xl bg-white py-3 text-center text-sm font-black text-blue-700 shadow-lg transition active:scale-95"
            >
              個別AI解析を見る
            </Link>
          </section>
        )}
        {/* RANKING */}
        <section
          ref={rankingRef}
          className="mt-5 rounded-[2rem] border border-white bg-white p-5 shadow-sm"
        >
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-xs font-black tracking-[0.18em] text-blue-600">
                RANKING
              </p>

              <h2 className="mt-2 text-2xl font-black">条件一致ランキング</h2>

              <p className="mt-1 text-sm font-bold text-slate-500">
                上位10銘柄を表示
              </p>
            </div>

            <div className="rounded-3xl bg-blue-50 px-4 py-3 text-center">
              <p className="text-xs font-black text-blue-500">HIT</p>
              <p className="text-3xl font-black text-blue-600">
                {filteredStocks.length}
              </p>
            </div>
          </div>

          {loading ? (
            <div className="mt-5 rounded-3xl bg-slate-50 p-6 text-center">
              <p className="text-2xl font-black">読み込み中...</p>
              <p className="mt-2 text-sm font-bold text-slate-500">
                AIが監視対象銘柄をスキャンしています。
              </p>
            </div>
          ) : filteredStocks.length === 0 ? (
            <div className="mt-5 rounded-3xl bg-slate-50 p-6 text-center">
              <p className="text-3xl font-black">今日は休もう</p>
              <p className="mt-2 text-sm font-bold leading-7 text-slate-500">
                条件に合うシグナルはありません。
                予算や条件を変更して確認してください。
              </p>
            </div>
          ) : (
            <div className="mt-5 space-y-3">
              {filteredStocks.slice(0, 10).map((stock, index) => (
                <StockRankingCard
                  key={`${stock.code}-${index}`}
                  stock={stock}
                  index={index}
                  onFavorite={() => addFavorite(stock.code, stock.name)}
                />
              ))}
            </div>
          )}
        </section>

        {/* HOT TOP3 */}
        {hotTop3.length > 0 && (
          <section className="mt-5 rounded-[2rem] border border-white bg-white p-5 shadow-sm">
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="text-xs font-black tracking-[0.18em] text-red-500">
                  HOT SIGNAL
                </p>

                <h2 className="mt-2 text-2xl font-black">🔥 今日のTOP3</h2>
              </div>

              <p className="rounded-full bg-red-50 px-3 py-2 text-xs font-black text-red-600">
                AIおすすめ順
              </p>
            </div>

            <div className="mt-4 space-y-3">
              {hotTop3.map((stock, index) => (
                <Link
                  key={stock.code}
                  href={`/analysis/${stock.code}`}
                  className="block rounded-3xl border border-red-100 bg-red-50/60 p-4 transition active:scale-[0.99]"
                >
                  <div className="flex justify-between gap-3">
                    <div>
                      <p className="text-sm font-black text-red-500">
                        {index + 1}位
                      </p>

                      <p className="mt-1 text-xl font-black">{stock.code}</p>

                      <p className="text-lg font-black text-slate-700">
                        {stock.name}
                      </p>

                      <p className="mt-2 line-clamp-2 text-xs font-bold leading-5 text-slate-500">
                        {stock.reason || "AI理由なし"}
                      </p>
                    </div>

                    <div className="text-right">
                      <p className="text-xs font-black text-slate-400">
                        AI POWER
                      </p>
                      <p className="text-4xl font-black text-red-500">
                        {stock.score}
                      </p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}
        {/* SCAN STATUS */}
        <section className="mt-5 rounded-[2rem] border border-white bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-black tracking-[0.18em] text-blue-600">
                SCAN STATUS
              </p>

              <h2 className="mt-2 text-2xl font-black">🔍 監視スキャン</h2>
            </div>

            <span className="rounded-full bg-emerald-50 px-3 py-2 text-xs font-black text-emerald-700">
              AUTO
            </span>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3">
            <div className="rounded-3xl bg-slate-50 p-5">
              <p className="text-xs font-black text-slate-400">監視対象銘柄</p>

              <p className="mt-2 text-4xl font-black">
                {totalStocks.toLocaleString()}
              </p>
            </div>

            <div className="rounded-3xl bg-blue-50 p-5">
              <p className="text-xs font-black text-blue-500">取得済み</p>

              <p className="mt-2 text-4xl font-black text-blue-600">
                {stocks.length.toLocaleString()}
              </p>
            </div>
          </div>

          <div className="mt-4 rounded-3xl border border-blue-100 bg-blue-50 p-4">
            <p className="text-sm font-black text-blue-700">
              60秒ごとに自動更新 / AI POWER V20で解析
            </p>
          </div>
        </section>

        {/* USAGE GUIDE */}
        <section className="mt-5 rounded-[2rem] border border-white bg-white p-5 shadow-sm">
          <p className="text-xs font-black tracking-[0.18em] text-blue-600">
            HOW TO USE
          </p>

          <h2 className="mt-2 text-2xl font-black">迷ったらこの順番</h2>

          <div className="mt-4 space-y-3">
            <GuideStep
              step="1"
              title="予算を選ぶ"
              text="まずは自分が使える金額を選びます。100株で買える銘柄だけに絞れます。"
            />

            <GuideStep
              step="2"
              title="AI POWER順で見る"
              text="基本はAI POWERが高い順。強い銘柄から順番に確認します。"
            />

            <GuideStep
              step="3"
              title="個別AI解析へ進む"
              text="気になる銘柄をタップして、利確・損切・AI理由を確認します。"
            />
          </div>
        </section>

        {/* BOTTOM NAV - APP WIDE STANDARD */}
        <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/90 px-2 py-2 backdrop-blur-xl">
          <div className="mx-auto grid max-w-md grid-cols-5 gap-1">
            <BottomNavItem href="/" icon="🏠" label="ホーム" />
            <BottomNavItem href="/today-market" icon="🤖" label="市場" />
            <BottomNavItem
              href="/ranking"
              icon="🏆"
              label="ランキング"
              active
            />
            <BottomNavItem href="/learning" icon="🧠" label="学習" />
            <BottomNavItem href="/favorites" icon="⭐" label="お気に入り" />
          </div>
        </nav>
      </div>
    </main>
  );
}
function StockRankingCard({
  stock,
  index,
  onFavorite,
}: {
  stock: Stock;
  index: number;
  onFavorite: () => void;
}) {
  return (
    <Link
      href={`/analysis/${stock.code}`}
      className={`block rounded-[2rem] border p-5 transition active:scale-[0.99] ${judgeBg(
        stock.score,
      )}`}
    >
      <div className="flex justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-white px-3 py-1 text-xs font-black shadow-sm">
              #{index + 1}
            </span>

            <span className={`text-xs font-black ${judgeColor(stock.score)}`}>
              {judgeLabel(stock.score)}
            </span>
          </div>

          <h3 className="mt-3 text-3xl font-black">{stock.code}</h3>

          <p className="text-lg font-black text-slate-700">{stock.name}</p>

          <p className="mt-3 text-sm font-bold leading-7 text-slate-600">
            {getAiAdvice(stock.score)}
          </p>

          <p className="mt-2 line-clamp-2 text-xs font-bold leading-6 text-slate-500">
            {stock.reason || "AI理由なし"}
          </p>

          <button
            onClick={(e) => {
              e.preventDefault();
              onFavorite();
            }}
            className="mt-4 rounded-2xl bg-yellow-300 px-4 py-2 text-xs font-black text-black transition active:scale-95"
          >
            ⭐ お気に入り
          </button>
        </div>

        <div className="text-right">
          <p className="text-xs font-black text-slate-400">AI POWER</p>

          <p className={`text-5xl font-black ${judgeColor(stock.score)}`}>
            {stock.score}
          </p>

          <div className="mt-4 space-y-2 rounded-2xl bg-white/70 p-3 text-xs font-bold shadow-sm">
            <p>株価 {yen(stock.price)}</p>
            <p>100株 {yen(stock.price * 100)}</p>

            <p>
              変化率{" "}
              <span
                className={
                  stock.changePercent >= 0 ? "text-red-500" : "text-emerald-600"
                }
              >
                {stock.changePercent >= 0 ? "+" : ""}
                {stock.changePercent}%
              </span>
            </p>

            <p>RSI {stock.rsi}</p>

            <p>{getPatternText(stock.patternSignal)}</p>
          </div>
        </div>
      </div>
    </Link>
  );
}

function GlassMini({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="rounded-3xl bg-white/10 p-3 text-center backdrop-blur">
      <p className="text-xs font-black text-blue-100">{label}</p>

      <p className="mt-1 text-2xl font-black">{value}</p>
    </div>
  );
}
function ChipButton({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-2xl border px-3 py-3 text-sm font-black transition active:scale-95 ${
        active
          ? "border-blue-500 bg-blue-600 text-white shadow-lg shadow-blue-100"
          : "border-slate-200 bg-slate-50 text-slate-700"
      }`}
    >
      {label}
    </button>
  );
}

function GuideStep({
  step,
  title,
  text,
}: {
  step: string;
  title: string;
  text: string;
}) {
  return (
    <div className="flex gap-3 rounded-3xl bg-slate-50 p-4">
      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-blue-600 text-sm font-black text-white">
        {step}
      </div>

      <div>
        <h3 className="text-base font-black">{title}</h3>

        <p className="mt-1 text-sm font-bold leading-6 text-slate-500">
          {text}
        </p>
      </div>
    </div>
  );
}

function BottomNavItem({
  href,
  icon,
  label,
  active = false,
}: {
  href: string;
  icon: string;
  label: string;
  active?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`min-w-0 rounded-2xl px-1 py-2 text-center text-[10px] font-black transition ${
        active
          ? "bg-blue-600 text-white shadow-lg shadow-blue-100"
          : "text-slate-500"
      }`}
    >
      <div className="text-base leading-none">{icon}</div>
      <div className="mt-1 truncate">{label}</div>
    </Link>
  );
}