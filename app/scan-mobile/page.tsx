"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

type Stock = {
  code: string;
  name: string;
  price: number;
  score?: number;
  rsi?: number;
  volumeRatio?: number;
  changeRate?: number;
  winRate?: number;
  reason?: string;
};

export default function ScanMobilePage() {
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [loading, setLoading] = useState(true);
 const [budget, setBudget] = useState(100000);

  useEffect(() => {
    const fetchStocks = async () => {
      try {
        const res = await fetch("/api/scan", { cache: "no-store" });
        const json = await res.json();
        setStocks(json.stocks || []);
      } catch (e) {
        console.error("scan error", e);
      } finally {
        setLoading(false);
      }
    };

    fetchStocks();
    const timer = setInterval(fetchStocks,30000);
    
    return () => clearInterval(timer);
  }, []);

  const bestSignal = useMemo(() => {
    return [...stocks]
      .filter((s) => s.price && s.price > 0)
      .sort((a, b) => (b.score || 0) - (a.score || 0))[0];
  }, [stocks]);

  if (loading) {
    return (
      <main className="min-h-screen bg-black text-white p-4 flex items-center justify-center">
        <p className="text-cyan-400 font-bold">SIGNALX 起動中...</p>
      </main>
    );
  }

  if (!bestSignal) {
    return (
      <main className="min-h-screen bg-black text-white p-4">
        <h1 className="text-2xl font-black text-red-500">SIGNALX</h1>
        <p className="mt-6 text-zinc-300">現在、有効な買いシグナルはありません。</p>
        <p className="mt-2 text-sm text-zinc-500">今日は無理に入らなくてOK。</p>
      </main>
    );
  }

  const price = bestSignal.price;
  const aiPower = bestSignal.score || 0;
  const winRate = bestSignal.winRate || aiPower;

  const takeProfit = Math.round(price * 1.025);
  const stopLoss = Math.round(price * 0.97);

  const profit = (takeProfit - price) * 100;
  const loss = (price - stopLoss) * 100;
  const expectedValue = Math.round(profit * (winRate / 100) - loss * (1 - winRate / 100));
  

const affordableSignals = [...stocks]
  .filter((s) => s.price && s.price * 100 <= budget)
  .sort((a, b) => (b.score || 0) - (a.score || 0))
  .slice(0, 3);

  const judge =
    aiPower >= 85 ? "買い" :
    aiPower >= 70 ? "強い" :
    aiPower >= 50 ? "静観" :
    "触るな";

  const judgeColor =
    aiPower >= 85 ? "text-green-400" :
    aiPower >= 70 ? "text-cyan-400" :
    aiPower >= 50 ? "text-yellow-300" :
    "text-red-400";

  return (
    <main className="min-h-screen bg-black text-white p-4 space-y-5">
      <section className="rounded-3xl border border-green-500/40 bg-zinc-950 p-5 shadow-lg">
        <p className="text-center text-zinc-500 text-sm">━━━━━━━━━━━━━━</p>
        <h1 className="text-center text-2xl font-black text-red-500">
          🔥 SIGNALX
        </h1>
        <p className="text-center text-zinc-500 text-sm">━━━━━━━━━━━━━━</p>

        <div className="mt-6 text-center">
          <p className={`text-4xl font-black ${judgeColor}`}>
            🟢 {judge}
          </p>

          <p className="mt-5 text-4xl font-black">
            {bestSignal.code}
          </p>

          <p className="mt-1 text-xl font-bold text-zinc-200">
            {bestSignal.name}
          </p>

          <p className="mt-6 text-sm text-zinc-500">現在値</p>
          <p className="text-4xl font-black">
            {price.toLocaleString()}円
          </p>

          <p className="mt-5 text-2xl font-bold text-white">
            成行100株
          </p>
          <div className="mt-4 rounded-2xl border border-yellow-500/30 bg-yellow-950/30 p-4">
  <p className="text-sm text-yellow-300">
    💰 必要資金
  </p>

  <p className="text-3xl font-black text-yellow-200">
    {(price * 100).toLocaleString()}円

  </p>
</div>

          <div className="mt-6 grid grid-cols-2 gap-3">
            <div className="rounded-2xl bg-green-950/50 border border-green-500/30 p-4">
              <p className="text-sm text-green-300">🎯 利確</p>
              <p className="text-2xl font-black">
                {takeProfit.toLocaleString()}円
              </p>
             <p className="mt-2 text-2xl text-green-400 font-black">
    +{profit.toLocaleString()}円
  </p>

            </div>

            <div className="rounded-2xl bg-red-950/50 border border-red-500/30 p-4">
              <p className="text-sm text-red-300">🛡 損切</p>
              <p className="text-2xl font-black">
                {stopLoss.toLocaleString()}円
              </p>
             <p className="mt-2 text-2xl text-red-400 font-black">
  -{loss.toLocaleString()}円
</p>
              
            </div>
          </div>

          <p className="mt-6 text-sm text-zinc-500">信頼度</p>
          <p className="text-5xl font-black text-cyan-400">
            {Math.round(aiPower)}%
          </p>
          <div className="mt-4">
  <p className="text-sm text-zinc-500">
    予想利益
  </p>

  <p className="text-3xl font-black text-green-400">
    +{profit.toLocaleString()}円
  </p>
</div>
        </div>
      </section>

      <section className="rounded-3xl border border-yellow-500/30 bg-zinc-950 p-5">
  <h2 className="text-xl font-black text-yellow-300">
    💰 予算{(budget / 10000).toLocaleString()}万円以内 TOP3
  </h2>
  <div className="mt-4 grid grid-cols-5 gap-2">
  {[10000,100000, 300000, 500000, 1000000].map((amount) => (
    <button
      key={amount}
      onClick={() => setBudget(amount)}
      className={`rounded-xl border p-2 text-sm font-black ${
        budget === amount
          ? "border-yellow-400 bg-yellow-400 text-black"
          : "border-zinc-700 bg-black text-zinc-300"
      }`}
    >
      {amount / 10000}万
    </button>
  ))}
</div>

  {affordableSignals.length === 0 ? (
  <p className="mt-4 text-zinc-400">
    現在、予算{(budget / 10000).toLocaleString()}万円以内で買える銘柄はありません。
  </p>
) : (
  <div className="mt-4 space-y-3">
    {affordableSignals.map((stock, index) => (
      <Link
  key={stock.code}
  href={`/analysis/${stock.code}`}
  className="block rounded-2xl border border-zinc-800 bg-black p-4 cursor-pointer hover:border-cyan-400 transition"
>
      
        <div className="flex justify-between">
          <div>
            <p className="text-yellow-300 font-black">
              {index + 1}位
            </p>

            <p className="text-xl font-black">
              {stock.code}
            </p>

            <p className="text-sm text-zinc-400">
              {stock.name}
            </p>
          </div>

          <div className="text-right">
            <p className="text-xs text-zinc-500">
              必要資金
            </p>

            <p className="text-lg font-black text-yellow-200">
              {(stock.price * 100).toLocaleString()}円
            </p>

            <p className="mt-2 text-green-400 font-black">
  🟢 買い
</p>

<p className="text-xs text-zinc-500">
  信頼度
</p>

<p className="text-cyan-400 font-black">
  {Math.round(stock.score || 0)}%
</p>
          </div>
        </div>
      </Link>
    ))}
  </div>
)}
</section>

      <section className="rounded-3xl border border-zinc-800 bg-zinc-950 p-5">
        <h2 className="text-xl font-black text-yellow-300">
          第2画面：損益イメージ
        </h2>

        <div className="mt-4 space-y-3">
          <div className="flex justify-between">
            <span className="text-zinc-400">利益予想</span>
            <span className="font-black text-green-400">
              +{profit.toLocaleString()}円
            </span>
          </div>

          <div className="flex justify-between">
            <span className="text-zinc-400">損失予想</span>
            <span className="font-black text-red-400">
              -{loss.toLocaleString()}円
            </span>
          </div>

          <div className="flex justify-between border-t border-zinc-800 pt-3">
            <span className="text-zinc-400">期待値</span>
            <span className={`font-black ${expectedValue >= 0 ? "text-green-400" : "text-red-400"}`}>
              {expectedValue >= 0 ? "+" : ""}
              {expectedValue.toLocaleString()}円
            </span>
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-zinc-800 bg-zinc-950 p-5">
        <h2 className="text-xl font-black text-cyan-300">
          第3画面：AI分析
        </h2>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <Info label="AI POWER" value={`${Math.round(aiPower)}%`} />
          <Info label="RSI" value={`${Math.round(bestSignal.rsi || 0)}`} />
          <Info label="出来高" value={`${bestSignal.volumeRatio?.toFixed(1) || "0.0"}倍`} />
          <Info label="勝率" value={`${Math.round(winRate)}%`} />
        </div>

        <div className="mt-5 rounded-2xl bg-black border border-zinc-800 p-4">
          <p className="text-sm text-zinc-500">AI判断理由</p>
          <p className="mt-2 text-sm text-zinc-300 leading-relaxed">
            {bestSignal.reason || "AIが価格・出来高・勢いを総合判断しています。"}
          </p>
        </div>

        <div className="mt-5 rounded-2xl bg-zinc-900 border border-zinc-800 p-6 text-center">
          <p className="text-zinc-500 text-sm">チャート</p>
          <p className="mt-2 text-zinc-400 text-sm">
            Ver2ではここにローソク足を表示予定
          </p>
        </div>
      </section>
    </main>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-black border border-zinc-800 p-4">
      <p className="text-xs text-zinc-500">{label}</p>
      <p className="mt-1 text-2xl font-black text-white">{value}</p>
    </div>
  );
}