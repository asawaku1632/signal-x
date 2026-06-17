"use client";

import { useEffect, useMemo, useState, useRef } from "react";
type Stock = {
  code: string;
  name: string;
  score: number;
  price: number;
  changePercent: number;
  rsi: number;
  volumeRatio: number;
  reason: string;
};

type SignalFilter = "hot" | "strong" | "all";
type BudgetFilter = 10000 | 100000 | 300000 | 500000 | 1000000 | "all";
type SortMode =
  | "expensive"
  | "cheap"
  | "score"
  | "change"
  | "money"
  | "down";

export default function ScanMobilePage() {
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [loading, setLoading] = useState(true);
  const [signalFilter, setSignalFilter] = useState<SignalFilter>("strong");
  const [budgetFilter, setBudgetFilter] = useState<BudgetFilter>(100000);
  const [sortMode, setSortMode] = useState<SortMode>("expensive");
  const rankingRef = useRef<HTMLDivElement>(null);
  const scrollToRanking = () => {
  rankingRef.current?.scrollIntoView({
    behavior: "smooth",
    block: "start",
  });
};

  async function fetchStocks() {
    try {
      const res = await fetch("/api/scan", { cache: "no-store" });
      const json = await res.json();
      setStocks(json.stocks || []);
    } catch (error) {
      console.error(error);
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

    if (sortMode === "expensive") {
      result.sort((a, b) => b.price - a.price);
    }

    if (sortMode === "cheap") {
      result.sort((a, b) => a.price - b.price);
    }

    if (sortMode === "score") {
      result.sort((a, b) => b.score - a.score);
    }

    if (sortMode === "change") {
      result.sort((a, b) => b.changePercent - a.changePercent);
    }

    if (sortMode === "money") {
      result.sort((a, b) => a.price * 100 - b.price * 100);
    }

    if (sortMode === "down") {
      result.sort((a, b) => a.changePercent - b.changePercent);
    }

    return result;
  }, [stocks, signalFilter, budgetFilter, sortMode]);

  const bestSignal = filteredStocks[0];
  const hotSignals = filteredStocks.filter((stock) => stock.score >= 85);
  const hotTop3 = [...hotSignals]
  .sort((a, b) => b.score - a.score)
  .slice(0, 3);
  const strongSignals = filteredStocks.filter(
  (stock) => stock.score >= 70
);

const marketJudge =
  hotSignals.length >= 3
    ? "🟢 強気"
    : strongSignals.length >= 5
    ? "🟡 厳選"
    : "⚪ 静観";

const marketComment =
  hotSignals.length >= 3
    ? "今日は攻めの日。強い銘柄を優先して狙えます。"
    : strongSignals.length >= 5
    ? "今日は本命候補あり。無理せず厳選して狙う日です。"
    : "今日は無理に入らず、様子見優先です。";
  const takeProfit = bestSignal
  ? Math.round(bestSignal.price * 1.05)
  : 0;

const stopLoss = bestSignal
  ? Math.round(bestSignal.price * 0.97)
  : 0;
  const winRate = bestSignal
  ? Math.min(95, Math.max(45, Math.round(bestSignal.score * 0.8)))
  : 0;
const riskRewardRatio = bestSignal
  ? Number(
      (
        (takeProfit - bestSignal.price) /
        (bestSignal.price - stopLoss)
      ).toFixed(1)
    )
  : 0;

const aiDecision = bestSignal
  ? bestSignal.score >= 85
    ? "🔥 激熱"
    : bestSignal.score >= 70
    ? "🟢 本命"
    : bestSignal.score >= 50
    ? "🟡 静観"
    : "⚪ 触るな"
  : "⚪ なし";

const tradeAction = bestSignal
  ? bestSignal.score >= 70
    ? "買い候補"
    : bestSignal.score >= 50
    ? "監視"
    : "見送り"
  : "なし";
  function judgeLabel(score: number) {
    if (score >= 85) return "激熱";
    if (score >= 70) return "強い";
    if (score >= 50) return "静観";
    return "触るな";
  }

  function judgeColor(score: number) {
    if (score >= 85) return "text-red-400";
    if (score >= 70) return "text-cyan-300";
    if (score >= 50) return "text-yellow-300";
    return "text-zinc-400";
  }

  function sortButtonClass(mode: SortMode) {
    return `rounded-xl py-3 font-bold border text-sm ${
      sortMode === mode
        ? "bg-green-400 text-black border-green-300"
        : "border-zinc-700 text-zinc-300"
    }`;
  }

  return (
    <main className="min-h-screen bg-black text-white p-4">
      <div className="max-w-md mx-auto space-y-5">
        <h1 className="text-center text-2xl font-black text-red-500">
          🔥 SIGNALX
        </h1>

        <section className="rounded-2xl border border-zinc-800 p-4 bg-zinc-950">
          <p className="text-xs text-zinc-400">監視銘柄数</p>
          <p className="text-3xl font-black">{stocks.length}銘柄</p>
          <p className="text-xs text-zinc-500 mt-1">60秒ごとに自動更新</p>
        </section>
        <section className="rounded-3xl border border-green-500 p-5 bg-zinc-950">
  <p className="text-green-300 text-xl font-black">
    📊 本日の市場総評
  </p>

  <p className="mt-3 text-3xl font-black">
    AI判定 {marketJudge}
  </p>

  <div className="mt-4 grid grid-cols-2 gap-3 text-center">
    <button
  onClick={() => {
  setSignalFilter("hot");
  setTimeout(scrollToRanking, 100);
}}
  className="rounded-2xl border border-red-500 p-3 text-center"
>
  <p className="text-xs text-zinc-400">激熱候補</p>
  <p className="text-3xl font-black text-red-400">
    {hotSignals.length}件
  </p>
</button>

    <button

    onClick={() => {
  setSignalFilter("strong");
  setTimeout(scrollToRanking, 100);
}}
  
  className="rounded-2xl border border-cyan-500 p-3 text-center"
>
  <p className="text-xs text-zinc-400">本命候補</p>
  <p className="text-3xl font-black text-cyan-300">
    {strongSignals.length}件
  </p>
</button>
  </div>

  <p className="mt-4 text-zinc-300 leading-relaxed">
    {marketComment}
  </p>
  {hotTop3.length > 0 ? (
  <div className="mt-5 border-t border-zinc-700 pt-4">
    <p className="font-black text-red-400">
      🔥 激熱候補TOP3
    </p>

    <div className="mt-3 space-y-2">
      {hotTop3.map((stock, index) => (
        <a
          key={stock.code}
          href={`/analysis/${stock.code}`}
          className="block rounded-xl border border-zinc-700 p-3"
        >
          <p className="font-black text-yellow-300">
            {index + 1}位
          </p>

          <p className="text-lg font-black">
            {stock.code}
          </p>

          <p className="text-zinc-300">
            {stock.name}
          </p>

          <p className="text-red-400 font-bold">
            信頼度 {stock.score}%
          
          </p>
        </a>
      ))}
    </div>
  </div>
) : (
  <div className="mt-5 border-t border-zinc-700 pt-4">
    <p className="font-black text-zinc-400">
      🔥 激熱候補TOP3
    </p>
    <p className="mt-2 text-sm text-zinc-500">
      現在、激熱候補はありません。
    </p>
  </div>
)}
</section>

        <section
  ref={rankingRef}
  className="space-y-3"
>
          <p className="font-bold text-yellow-300">🔥 シグナルフィルター</p>

          <div className="grid grid-cols-3 gap-2">
            <button
              onClick={() => setSignalFilter("hot")}
              className={`rounded-xl py-3 font-bold border ${
                signalFilter === "hot"
                  ? "bg-red-500 text-white border-red-400"
                  : "border-zinc-700 text-zinc-300"
              }`}
            >
              激熱
            </button>

            <button
              onClick={() => setSignalFilter("strong")}
              className={`rounded-xl py-3 font-bold border ${
                signalFilter === "strong"
                  ? "bg-cyan-400 text-black border-cyan-300"
                  : "border-zinc-700 text-zinc-300"
              }`}
            >
              本命以上
            </button>

            <button
              onClick={() => setSignalFilter("all")}
              className={`rounded-xl py-3 font-bold border ${
                signalFilter === "all"
                  ? "bg-white text-black border-white"
                  : "border-zinc-700 text-zinc-300"
              }`}
            >
              全件
            </button>
          </div>
        </section>

        <section className="space-y-3">
          <p className="font-bold text-yellow-300">💴 予算フィルター</p>

          <div className="grid grid-cols-3 gap-2">
            {[
              { label: "1万", value: 10000 },
              { label: "10万", value: 100000 },
              { label: "30万", value: 300000 },
              { label: "50万", value: 500000 },
              { label: "100万", value: 1000000 },
              { label: "制限なし", value: "all" },
            ].map((item) => (
              <button
                key={item.label}
                onClick={() => setBudgetFilter(item.value as BudgetFilter)}
                className={`rounded-xl py-3 font-bold border ${
                  budgetFilter === item.value
                    ? "bg-yellow-400 text-black border-yellow-300"
                    : "border-zinc-700 text-zinc-300"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </section>

        <section className="space-y-3">
          <p className="font-bold text-yellow-300">📊 並び替え</p>

          <div className="grid grid-cols-2 gap-2">
            <button
  onClick={() => setSortMode("expensive")}
  className={sortButtonClass("expensive")}
>
  💰 株価高い順
</button>

<button
  onClick={() => setSortMode("cheap")}
  className={sortButtonClass("cheap")}
>
  💴 株価安い順
</button>

<button
  onClick={() => setSortMode("change")}
  className={sortButtonClass("change")}
>
  📈 上昇率順
</button>

<button
  onClick={() => setSortMode("down")}
  className={sortButtonClass("down")}
>
  📉 下落率順
</button>

<button
  onClick={() => setSortMode("score")}
  className={sortButtonClass("score")}
>
  🔥 AI POWER順
</button>

<button
  onClick={() => setSortMode("money")}
  className={sortButtonClass("money")}
>
  🏦 必要資金順
</button>
          </div>
        </section>

        <section className="rounded-2xl border border-zinc-800 p-4 bg-zinc-950">
          <p className="text-sm text-zinc-400">該当銘柄</p>
          <p className="text-4xl font-black text-green-400">
            {filteredStocks.length}件
          </p>
          </section>

<section className="rounded-3xl border-2 border-red-500 p-5 bg-zinc-950 text-center">
  <p className="text-red-400 text-xl font-black">
    🔥 激熱候補
  </p>

  <p className="mt-3 text-5xl font-black text-red-400">
    {hotSignals.length}件
  </p>

  <p className="mt-2 text-sm text-zinc-400">
    AI POWER 85以上のみ表示
  </p>
</section>

{bestSignal && (
  <a
    href={`/analysis/${bestSignal.code}`}
    className="block rounded-3xl border-2 border-yellow-400 p-5 bg-zinc-950 text-center"
  >
  
    
    <p className="text-yellow-300 text-xl font-black">
      👑 本日の大本命
    </p>

    <p className="mt-4 text-5xl font-black">
      {bestSignal.code}
    </p>

    <p className="text-xl text-zinc-300">
      {bestSignal.name}
    </p>

    <p className="mt-2 text-green-300 text-3xl font-black">
      信頼度 {bestSignal.score}％
    </p>
<p className="mt-2 text-cyan-300 text-3xl font-black">
  勝率 {winRate}%
</p>
<div className="mt-4 space-y-2">

  <p className="text-cyan-300 font-bold">
    AI判定：{aiDecision}
  </p>

  <p className="text-green-400 font-bold">
    推奨：{tradeAction}
  </p>

  <p className="text-yellow-300 font-bold">
    RR比：{riskRewardRatio}
  </p>

</div>
    <p className="mt-3 text-yellow-300 font-bold">
      必要資金 {(bestSignal.price * 100).toLocaleString()}円
    </p>

    <p className="mt-2 text-green-400">
      🎯利確 {Math.round(bestSignal.price * 1.05).toLocaleString()}円
    </p>

    <p className="text-red-400">
      🛡 損切 {Math.round(bestSignal.price * 0.97).toLocaleString()}円
    </p>
<p className="mt-3 text-xs text-zinc-400">
  👆 タップで個別AI解析へ
</p>
    </a>

 
)}
{bestSignal && (
  <section className="rounded-3xl border border-cyan-500 p-5 bg-zinc-950">
    <p className="text-cyan-300 text-xl font-black">
      🤖 AIコメント
    </p>

    <p className="mt-3 text-zinc-200 leading-relaxed">
      本日は
      <span className="font-bold text-white">
        {bestSignal.code} {bestSignal.name}
      </span>
      が最有力候補です。
    </p>

    <p className="mt-2 text-zinc-300 leading-relaxed">
      必要資金は
      <span className="font-bold text-yellow-300">
        {(bestSignal.price * 100).toLocaleString()}円
      </span>
      。
      勝率目安は
<span className="font-bold text-cyan-300">
  {winRate}%
</span>
です。
      
      現在の条件では、この銘柄を中心に監視するのが良さそうです。
    </p>

    <p className="mt-2 text-zinc-400 text-sm leading-relaxed">
      ただし、損切ラインに近づいた場合は無理せず撤退を優先してください。
    </p>
  </section>
)}
       

        {loading ? (
          <p className="text-center text-zinc-400">読み込み中...</p>
        ) : !bestSignal ? (
          <section className="rounded-2xl border border-zinc-800 p-5 bg-zinc-950 text-center">
            <p className="text-2xl font-black">今日は休もう</p>
            <p className="text-zinc-400 mt-2">
              条件に合うシグナルはありません。
            </p>
          </section>
        ) : (
          <>
            

            <section
  ref={rankingRef}
  className="space-y-3"
>
       <p className="font-bold text-yellow-300">
  条件一致ランキング TOP10
</p>

{filteredStocks.slice(0, 10).map((stock, index) => (
  <a
    key={`${stock.code}-${index}`}
    href={`/analysis/${stock.code}`}
    className="block rounded-2xl border border-zinc-800 bg-zinc-950 p-4"
  >
    <div className="flex justify-between items-center">
      <div>
        <p className="text-yellow-300 font-black">
          {index + 1}位
        </p>

        <p className="text-2xl font-black">{stock.code}</p>

        <p className="text-zinc-300">{stock.name}</p>

        <button
          onClick={(e) => {
            e.preventDefault();
            addFavorite(stock.code, stock.name);
          }}
          className="mt-2 rounded-lg bg-yellow-400 px-3 py-1 text-xs font-bold text-black"
        >
          ⭐ お気に入り
        </button>
      </div>

      <div className="text-right">
        <p className={judgeColor(stock.score)}>
          {judgeLabel(stock.score)}
        </p>

        <p className="text-xl font-black">{stock.score}%</p>

        <p className="text-xs text-zinc-400">
          株価 {stock.price.toLocaleString()}円
        </p>

        <p className="text-xs text-zinc-400">
          必要資金 {(stock.price * 100).toLocaleString()}円
        </p>

        <p className="text-xs text-green-400">
          🎯 利確 {Math.round(stock.price * 1.05).toLocaleString()}円
        </p>

        <p className="text-xs text-red-400">
          🛡 損切 {Math.round(stock.price * 0.97).toLocaleString()}円
        </p>

        <p
          className={`text-xs ${
            stock.changePercent >= 0
              ? "text-green-400"
              : "text-red-400"
          }`}
        >
          変化率 {stock.changePercent}%
        </p>
      </div>
    </div>
  </a>
))}
            </section>
          </>
        )}
      </div>
    </main>
  );
}