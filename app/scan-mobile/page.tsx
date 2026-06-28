"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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

function yen(value?: number | null) {
  if (value === undefined || value === null) return "-";
  return `${Math.round(value).toLocaleString()}円`;
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
  if (score >= 70) return "text-green-600";
  if (score >= 50) return "text-yellow-600";
  return "text-slate-500";
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
  if (hot >= 80)
    return "市場全体が非常に強い状態です。Sランク銘柄を積極的に狙える一日です。";

  if (hot >= 30)
    return "今日は攻められる相場です。Sランク・Aランクを中心に監視しましょう。";

  if (hot >= 10)
    return "強い銘柄はありますが、飛び乗りは避けて条件を確認してから入りましょう。";

  if (strong >= 30)
    return "本命候補はあります。焦らず条件の整った銘柄だけを選びたい相場です。";

  return "今日は無理に売買せず、様子見を優先したい相場です。";
}

export default function ScanMobilePage() {
  const searchParams = useSearchParams();

  const [stocks, setStocks] = useState<Stock[]>([]);
  const [totalStocks, setTotalStocks] = useState(0);
  const [loading, setLoading] = useState(true);
  const [signalFilter, setSignalFilter] = useState<SignalFilter>("strong");

  const initialBudget =
    Number(searchParams.get("budget")) || 1000000;

  const [budgetFilter, setBudgetFilter] =
    useState<BudgetFilter>(initialBudget as BudgetFilter);

  const [sortMode, setSortMode] = useState<SortMode>("score");

  const rankingRef = useRef<HTMLDivElement>(null);

  const scrollToRanking = () => {
    rankingRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  };

  async function fetchStocks() {
    try {
      const res = await fetch("/api/scan?limit=1000", {
        cache: "no-store",
      });

      const json = await res.json();

      const list: Stock[] = Array.isArray(json)
        ? json
        : Array.isArray(json.stocks)
        ? json.stocks
        : [];

      setStocks(list);
      setTotalStocks(json.totalStockList ?? list.length);
    } catch (error) {
      console.error("scan-mobile fetch error:", error);
    } finally {
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

  const hotSignals = useMemo(
    () => stocks.filter((stock) => stock.score >= 85),
    [stocks]
  );

  const strongSignals = useMemo(
    () => stocks.filter((stock) => stock.score >= 70),
    [stocks]
  );

  const filteredStocks = useMemo(() => {
    const result = stocks.filter((stock) => {
      const requiredMoney = stock.price * 100;

      const signalOk =
        signalFilter === "hot"
          ? stock.score >= 85
          : signalFilter === "strong"
          ? stock.score >= 70
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
  }, [stocks, signalFilter, budgetFilter, sortMode]);

  const bestSignal = filteredStocks[0];
  const hotTop3 = [...hotSignals].sort((a, b) => b.score - a.score).slice(0, 3);

  const marketJudge = getMarketJudge(hotSignals.length, strongSignals.length);
  const marketComment = getMarketComment(hotSignals.length, strongSignals.length);

  const winRate = bestSignal
    ? Math.min(95, Math.max(45, Math.round(bestSignal.score * 0.75 + 12)))
    : 0;

  const takeProfit = bestSignal
    ? bestSignal.takeProfit ?? Math.round(bestSignal.price * 1.03)
    : 0;

  const stopLoss = bestSignal
    ? bestSignal.stopLoss ?? Math.round(bestSignal.price * 0.98)
    : 0;

  const expectedProfit = bestSignal
    ? (takeProfit - bestSignal.price) * 100
    : 0;

  const riskRewardRatio = bestSignal
    ? Number(
        (
          (takeProfit - bestSignal.price) /
          Math.max(bestSignal.price - stopLoss, 1)
        ).toFixed(1)
      )
    : 0;
      return (
    <main className="min-h-screen bg-[#f7f9fc] text-slate-900 pb-24">
      <div className="mx-auto max-w-md px-4 pt-5 space-y-5">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-black tracking-tight">
              SIGNAL<span className="text-blue-600">X</span>
            </h1>
            <p className="text-xs font-black tracking-[0.22em] text-slate-500">
              AI STOCK SCAN
            </p>
          </div>

          <button
            onClick={fetchStocks}
            className="rounded-2xl bg-white px-4 py-3 text-xl shadow-sm border border-slate-200"
          >
            🔄
          </button>
        </header>

        {budgetFilter !== "all" && (
          <section className="rounded-[24px] border border-emerald-200 bg-gradient-to-r from-emerald-50 to-green-100 p-4 shadow-sm">
            <p className="text-xs font-black tracking-wider text-emerald-700">
              💴 現在の予算
            </p>

            <h2 className="mt-1 text-3xl font-black text-emerald-700">
              {Number(budgetFilter).toLocaleString()}円以内
            </h2>

            <p className="mt-2 text-sm font-bold text-slate-600">
              この予算で購入できる銘柄だけ表示しています。
            </p>
          </section>
        )}

        <section className="rounded-[28px] bg-white border border-slate-200 p-5 shadow-sm">
          <h2 className="text-xl font-black">💴 予算フィルター</h2>

          <div className="mt-4 grid grid-cols-3 gap-2">
            {[
              { label: "1万", value: 10000 },
              { label: "10万", value: 100000 },
              { label: "30万", value: 300000 },
              { label: "50万", value: 500000 },
              { label: "100万", value: 1000000 },
              { label: "制限なし", value: "all" },
            ].map((item) => (
              <FilterButton
                key={item.label}
                active={budgetFilter === item.value}
                label={item.label}
                onClick={() => {
                  setBudgetFilter(item.value as BudgetFilter);
                  setTimeout(scrollToRanking, 100);
                }}
              />
            ))}
          </div>
        </section>

        <section className="rounded-[28px] bg-white border border-slate-200 p-5 shadow-sm">
          <h2 className="text-xl font-black">📊 並び替え</h2>

          <div className="mt-4 grid grid-cols-2 gap-2">
            <FilterButton
              active={sortMode === "score"}
              label="🔥 AI POWER順"
              onClick={() => setSortMode("score")}
            />
            <FilterButton
              active={sortMode === "change"}
              label="📈 上昇率順"
              onClick={() => setSortMode("change")}
            />
            <FilterButton
              active={sortMode === "down"}
              label="📉 下落率順"
              onClick={() => setSortMode("down")}
            />
            <FilterButton
              active={sortMode === "money"}
              label="🏦 必要資金順"
              onClick={() => setSortMode("money")}
            />
            <FilterButton
              active={sortMode === "cheap"}
              label="💴 株価安い順"
              onClick={() => setSortMode("cheap")}
            />
            <FilterButton
              active={sortMode === "expensive"}
              label="💰 株価高い順"
              onClick={() => setSortMode("expensive")}
            />
          </div>
        </section>

        <section
          ref={rankingRef}
          className="rounded-[28px] bg-white border border-slate-200 p-5 shadow-sm"
        >
          <div className="flex items-end justify-between">
            <div>
              <h2 className="text-xl font-black">条件一致ランキング</h2>
              <p className="text-sm font-bold text-slate-500">
                上位10銘柄を表示
              </p>
            </div>

            <p className="text-4xl font-black text-blue-600">
              {filteredStocks.length}
            </p>
          </div>

          {loading ? (
            <p className="mt-5 text-center font-bold text-slate-500">
              読み込み中...
            </p>
          ) : filteredStocks.length === 0 ? (
            <div className="mt-5 rounded-2xl bg-slate-50 p-5 text-center">
              <p className="text-2xl font-black">今日は休もう</p>
              <p className="mt-2 text-sm font-bold text-slate-500">
                条件に合うシグナルはありません。
              </p>
            </div>
          ) : (
            <div className="mt-5 space-y-3">
              {filteredStocks.slice(0, 10).map((stock, index) => (
                <a
                  key={`${stock.code}-${index}`}
                  href={`/analysis/${stock.code}`}
                  className="block rounded-2xl bg-slate-50 border border-slate-100 p-4"
                >
                  <div className="flex justify-between gap-3">
                    <div>
                      <p className="text-sm font-black text-blue-600">
                        {index + 1}位
                      </p>

                      <p className="mt-1 text-3xl font-black">
                        {stock.code}
                      </p>

                      <p className="text-lg font-black text-slate-700">
                        {stock.name}
                      </p>

                      <p className={`mt-1 text-sm font-black ${judgeColor(stock.score)}`}>
                        {judgeLabel(stock.score)}
                      </p>

                      <p className="mt-2 text-xs font-bold text-slate-500">
                        {stock.reason || "AI理由なし"}
                      </p>

                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          addFavorite(stock.code, stock.name);
                        }}
                        className="mt-3 rounded-xl bg-yellow-300 px-3 py-2 text-xs font-black text-black"
                      >
                        ⭐ お気に入り
                      </button>
                    </div>

                    <div className="text-right">
                      <p className="text-xs font-black text-slate-400">
                        AI
                      </p>
                      <p className="text-4xl font-black text-blue-600">
                        {stock.score}
                      </p>

                      <div className="mt-3 space-y-1 text-xs font-bold text-slate-500">
                        <p>株価 {yen(stock.price)}</p>
                        <p>100株 {yen(stock.price * 100)}</p>
                        <p>
                          変化率{" "}
                          <span
                            className={
                              stock.changePercent >= 0
                                ? "text-red-500"
                                : "text-green-600"
                            }
                          >
                            {stock.changePercent >= 0 ? "+" : ""}
                            {stock.changePercent}%
                          </span>
                        </p>
                        <p>形状 {getPatternText(stock.patternSignal)}</p>
                      </div>
                    </div>
                  </div>
                </a>
              ))}
            </div>
          )}
        </section>
                {hotTop3.length > 0 && (
          <section className="rounded-[28px] bg-white border border-slate-200 p-5 shadow-sm">
            <h2 className="text-xl font-black">🔥 激熱候補 TOP3</h2>

            <div className="mt-4 space-y-3">
              {hotTop3.map((stock, index) => (
                <a
                  key={stock.code}
                  href={`/analysis/${stock.code}`}
                  className="block rounded-2xl bg-slate-50 border border-slate-100 p-4"
                >
                  <div className="flex justify-between gap-3">
                    <div>
                      <p className="text-sm font-black text-yellow-500">
                        {index + 1}位
                      </p>
                      <p className="mt-1 text-2xl font-black">
                        {stock.code}
                      </p>
                      <p className="text-lg font-black text-slate-700">
                        {stock.name}
                      </p>
                      <p className="mt-1 text-xs font-bold text-slate-500">
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
                </a>
              ))}
            </div>
          </section>
        )}

        {bestSignal && (
          <section className="rounded-[28px] bg-gradient-to-br from-blue-600 to-indigo-700 p-5 text-white shadow-sm">
            <p className="text-sm font-black text-blue-100">
              👑 本日の大本命
            </p>

            <div className="mt-3 flex justify-between gap-3">
              <div>
                <p className="text-5xl font-black">{bestSignal.code}</p>
                <p className="text-2xl font-black">{bestSignal.name}</p>
                <p className="mt-2 text-sm font-bold text-blue-100">
                  {bestSignal.reason || "AI理由なし"}
                </p>
              </div>

              <div className="text-right">
                <p className="text-xs font-black text-blue-100">AI POWER</p>
                <p className="text-5xl font-black">{bestSignal.score}</p>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3">
              <BlueMini label="AI勝率" value={`${winRate}%`} />
              <BlueMini label="RR比" value={`${riskRewardRatio}`} />
              <BlueMini label="期待利益" value={`+${yen(expectedProfit)}`} />
              <BlueMini label="必要資金" value={yen(bestSignal.price * 100)} />
              <BlueMini label="利確" value={yen(takeProfit)} />
              <BlueMini label="損切" value={yen(stopLoss)} />
            </div>

            <a
              href={`/analysis/${bestSignal.code}`}
              className="mt-5 block rounded-2xl bg-white py-4 text-center font-black text-blue-700"
            >
              個別AI解析を見る
            </a>
          </section>
        )}

        <section className="rounded-[28px] bg-white border border-slate-200 p-5 shadow-sm">
          <p className="text-sm font-black text-blue-600">🔍 監視スキャン</p>

          <div className="mt-3 flex items-end justify-between">
            <div>
              <p className="text-5xl font-black">
                {totalStocks.toLocaleString()}
              </p>
              <p className="mt-1 text-sm font-bold text-slate-500">
                監視対象銘柄
              </p>
            </div>

            <div className="text-right">
              <p className="text-xs font-black text-slate-400">取得済み</p>
              <p className="text-3xl font-black text-blue-600">
                {stocks.length}
              </p>
            </div>
          </div>

          <div className="mt-4 rounded-2xl bg-blue-50 border border-blue-100 p-3">
            <p className="text-sm font-bold text-blue-700">
              60秒ごとに自動更新 / AI POWER V3で解析
            </p>
          </div>
        </section>

        <section className="rounded-[28px] bg-white border border-green-200 p-5 shadow-sm">
          <p className="text-sm font-black text-green-600">📊 今日の市場総評</p>

          <h2 className="mt-3 text-4xl font-black">
            AI判定 {marketJudge}
          </h2>

          <div className="mt-5 grid grid-cols-2 gap-3">
            <button
              onClick={() => {
                setSignalFilter("hot");
                setTimeout(scrollToRanking, 100);
              }}
              className="rounded-2xl bg-red-50 border border-red-200 p-4 text-center"
            >
              <p className="text-xs font-black text-red-400">激熱候補</p>
              <p className="mt-1 text-4xl font-black text-red-500">
                {hotSignals.length}
              </p>
            </button>

            <button
              onClick={() => {
                setSignalFilter("strong");
                setTimeout(scrollToRanking, 100);
              }}
              className="rounded-2xl bg-cyan-50 border border-cyan-200 p-4 text-center"
            >
              <p className="text-xs font-black text-cyan-500">本命候補</p>
              <p className="mt-1 text-4xl font-black text-cyan-600">
                {strongSignals.length}
              </p>
            </button>
          </div>

          <p className="mt-4 text-sm font-bold leading-7 text-slate-600">
            {marketComment}
          </p>
        </section>
      </div>
    </main>
  );
}

function FilterButton({
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
      className={`rounded-2xl border px-3 py-3 text-sm font-black ${
        active
          ? "border-blue-500 bg-blue-600 text-white"
          : "border-slate-200 bg-slate-50 text-slate-700"
      }`}
    >
      {label}
    </button>
  );
}

function BlueMini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-white/15 p-3 text-center">
      <p className="text-xs font-black text-blue-100">{label}</p>
      <p className="mt-1 text-xl font-black">{value}</p>
    </div>
  );
}