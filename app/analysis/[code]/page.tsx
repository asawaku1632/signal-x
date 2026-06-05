"use client";

import { getAiDecision } from "@/app/lib/aiDecision";
import { getAiFinalJudge } from "@/app/lib/aiFinalJudge";
import { getAiWinRate } from "@/app/lib/aiWinRate";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

type Candle = {
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
};

type Signal = {
  code: string;
  name: string;
  score: number;
  reason?: string;
  price: number;
  changePercent: number;
  rsi: number;
  volumeRatio: number;
  learningBonus?: number;
  candles?: Candle[];
};

export default function AnalysisPage() {
  const params = useParams();
  const code = String(params.code);

  const [signal, setSignal] = useState<Signal | null>(null);
  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    const fetchSignal = async () => {
      const res = await fetch("/api/scan");
      const json = await res.json();

      const found = (json.stocks || []).find(
        (item: Signal) => item.code === code
      );

      setSignal(found || null);
    };
const fetchStats = async () => {
  const res = await fetch("/api/learning/stats");
  const json = await res.json();
  setStats(json);
};

fetchStats();
    fetchSignal();

    const timer = setInterval(() => {
      fetchSignal();
    }, 30000);

    return () => clearInterval(timer);
  }, [code]);

  if (!signal) {
    return (
      <main className="min-h-screen bg-black text-white flex items-center justify-center">
        AI解析中...
      </main>
    );
  }

  const ai = getAiDecision({
    score: signal.score,
    rsi: signal.rsi,
    volumeRatio: signal.volumeRatio,
    changePercent: signal.changePercent,
    learningBonus: signal.learningBonus,
  });

  const finalJudge = getAiFinalJudge({
    score: signal.score,
    rsi: signal.rsi,
    volumeRatio: signal.volumeRatio,
    changePercent: signal.changePercent,
    learningBonus: signal.learningBonus,
    reason: signal.reason,
  });

  const winRate = getAiWinRate({
  score: signal.score,
  rsi: signal.rsi,
  volumeRatio: signal.volumeRatio,
  changePercent: signal.changePercent,
  learningBonus: signal.learningBonus,
});
const takeProfit = Math.round(signal.price * 1.025);
const stopLoss = Math.round(signal.price * 0.97);

const profit = (takeProfit - signal.price) * 100;
const loss = (signal.price - stopLoss) * 100;

const tradeJudge = finalJudge.label;
  finalJudge.label === "大本命" ? "大本命" :
  finalJudge.label === "本命" ? "買い" :
  finalJudge.label === "無理に入るな" ? "静観" :
  finalJudge.label === "静観" ? "静観" :
  finalJudge.label === "危険" ? "撤退" :
  "撤退";

const tradeColor =
  finalJudge.label === "大本命"
    ? "text-purple-400"
    : finalJudge.label === "本命"
    ? "text-green-400"
    : finalJudge.label === "無理に入るな"
    ? "text-cyan-300"
    : finalJudge.label === "静観"
    ? "text-yellow-300"
    : finalJudge.label === "危険"
    ? "text-orange-400"
    : "text-red-500";
  return (
    <main className="min-h-screen bg-black text-white flex justify-center p-4">
      <div className="w-full max-w-sm">
<section className="mb-5 rounded-3xl border border-orange-500/60 bg-black p-5 text-center">
  <p className="text-red-500 font-black text-xl">
    🔥 SIGNALX
  </p>

  <p className={`mt-4 text-4xl font-black ${tradeColor}`}>
    🟢 {tradeJudge}
  </p>

  <p className="mt-4 text-5xl font-black">
    {signal.code}
  </p>

  <p className="text-xl text-zinc-300">
    {signal.name}
  </p>

  <p className="mt-5 text-zinc-400">
    現在値
  </p>

  <p className="text-3xl font-black">
    {signal.price.toLocaleString()}円
  </p>

  <p className="mt-2 text-zinc-400">
    成行100株
  </p>

  <div className="grid grid-cols-2 gap-3 mt-6">
    <div className="rounded-xl border border-green-500 p-3">
      <p className="text-green-400 font-black">
        🎯 利確
      </p>

      <p className="text-2xl font-black">
        {takeProfit.toLocaleString()}円
      </p>

      <p className="text-green-400 font-black">
        +{profit.toLocaleString()}円
      </p>
    </div>

    <div className="rounded-xl border border-red-500 p-3">
      <p className="text-red-400 font-black">
        🛡 損切
      </p>

      <p className="text-2xl font-black">
        {stopLoss.toLocaleString()}円
      </p>

      <p className="text-red-400 font-black">
        -{loss.toLocaleString()}円
      </p>
    </div>
  </div>

  <p className="mt-6 text-cyan-400 text-4xl font-black">
    信頼度 {signal.score}%
  </p>

  <div className="mt-4 text-left">
  <p className="text-zinc-400 text-sm mb-2">
    AI理由
  </p>

  {finalJudge.reasons.slice(0, 3).map((reason, index) => (
    <p
      key={index}
     className="text-zinc-100 text-base font-bold"
    >
      • {reason}
    </p>
  ))}
</div>
</section>

        <section className="rounded-3xl border border-zinc-800 bg-zinc-950 p-5 shadow-2xl">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[10px] text-gray-500">
                SIGNALX AI ANALYSIS
              </p>

              <h1 className="mt-1 text-4xl font-black">{signal.name}</h1>

              <p className="mt-1 text-sm text-gray-500">CODE {signal.code}</p>
            </div>

            <div className="text-right">
              <p className="text-[10px] text-gray-500">AI POWER</p>

              <p
                className={`text-6xl font-black ${
                  signal.score >= 90
                    ? "text-purple-400"
                    : signal.score >= 70
                    ? "text-red-400"
                    : signal.score >= 50
                    ? "text-cyan-300"
                    : "text-gray-500"
                }`}
              >
                {signal.score}
              </p>
            </div>
          </div>

          <section
            className={`mt-5 rounded-3xl border ${finalJudge.border} ${finalJudge.bg} p-5`}
          >
            <p className="text-xs text-gray-400">AI FINAL JUDGE</p>

            <p className={`mt-3 text-5xl font-black ${finalJudge.color}`}>
              {finalJudge.label}
            </p>

            <p className="mt-3 text-2xl font-black text-white">
              {finalJudge.title}
            </p>

            <p className="mt-2 text-sm text-zinc-300">
              {finalJudge.message}
            </p>

            <div className="mt-5 space-y-2">
              {finalJudge.reasons.slice(0, 5).map((reason, index) => (
                <div
                  key={`${reason}-${index}`}
                  className="rounded-2xl bg-black/40 px-3 py-2 text-sm text-zinc-200"
                >
                  ・{reason}
                </div>
              ))}
            </div>
          </section>

          <section
            className={`mt-5 rounded-3xl border ${ai.border} bg-black p-4`}
          >
            <p className="text-xs text-gray-500">AI TRADE DECISION</p>

            <p className={`mt-3 text-3xl font-black ${ai.color}`}>
              {ai.label}
            </p>

            <p className="mt-2 text-lg font-bold text-zinc-200">
              {ai.message}
            </p>
          </section>

          <div className="mt-5 grid grid-cols-2 gap-3">
            <div className="rounded-2xl bg-zinc-900 p-4">
              <p className="text-[10px] text-gray-500">現在価格</p>
              <p className="mt-2 text-4xl font-black">{signal.price}円</p>
            </div>

            <div className="rounded-2xl bg-zinc-900 p-4">
              <p className="text-[10px] text-gray-500">変化率</p>

              <p
                className={`mt-2 text-4xl font-black ${
                  signal.changePercent >= 0 ? "text-red-400" : "text-blue-400"
                }`}
              >
                {signal.changePercent}%
              </p>
            </div>

            <div className="rounded-2xl bg-zinc-900 p-4">
              <p className="text-[10px] text-gray-500">RSI</p>
              <p className="mt-2 text-4xl font-black text-cyan-400">
                {signal.rsi}
              </p>
            </div>

            <div className="rounded-2xl bg-zinc-900 p-4">
              <p className="text-[10px] text-gray-500">出来高倍率</p>
              <p className="mt-2 text-4xl font-black text-orange-400">
                {signal.volumeRatio}倍
              </p>
            </div>
          </div>

          <section className="mt-5 rounded-3xl border border-green-900 bg-black p-4">
  <p className="text-xs text-green-400">AI WIN RATE</p>

  <div className="mt-3 grid grid-cols-2 gap-3">
    <div className="rounded-2xl bg-zinc-900 p-3">
      <p className="text-[10px] text-gray-500">30分後勝率</p>

      <p className="text-3xl font-black text-green-400">
     {winRate.win30}%
     </p>


    </div>

    <div className="rounded-2xl bg-zinc-900 p-3">
      <p className="text-[10px] text-gray-500">1時間後勝率</p>

      <p className="text-3xl font-black text-cyan-400">
       {winRate.win60}%
      </p>
    </div>
  </div>
</section>

{stats && (
  <section className="mt-5 rounded-3xl border border-green-900 bg-black p-4">
    <p className="text-xs text-green-400">AI LEARNING STATS</p>

    <div className="mt-3 grid grid-cols-3 gap-3">
      <div className="rounded-2xl bg-zinc-900 p-3">
        <p className="text-[10px] text-gray-500">総判定数</p>
        <p className="text-2xl font-black">{stats.total}</p>
      </div>

      <div className="rounded-2xl bg-zinc-900 p-3">
        <p className="text-[10px] text-gray-500">勝ち</p>
        <p className="text-2xl font-black text-green-400">{stats.wins}</p>
      </div>

      <div className="rounded-2xl bg-zinc-900 p-3">
        <p className="text-[10px] text-gray-500">勝率</p>
        <p className="text-2xl font-black text-cyan-400">{stats.winRate}%</p>
      </div>
    </div>
  </section>
)}

          <section className="mt-5 rounded-3xl border border-cyan-900 bg-black p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-cyan-400">AI通知</p>

                <p className="mt-2 text-2xl font-black">SIGNAL ALERT</p>
              </div>

              <div className="h-3 w-3 animate-pulse rounded-full bg-cyan-400" />
            </div>

            <div className="mt-4 rounded-2xl bg-zinc-900 p-4">
              <p className="text-lg font-bold text-white">
                {signal.reason || "目立つシグナルなし"}
              </p>
            </div>
          </section>

          <section className="mt-5 rounded-3xl border border-red-900 bg-black p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-red-400">リスク分析</p>

                <p className="mt-2 text-3xl font-black">AI危険度</p>
              </div>

              <p className="text-6xl font-black text-red-400">
                {100 - signal.score}
              </p>
            </div>

            <div className="mt-4 h-4 overflow-hidden rounded-full bg-zinc-800">
              <div
                className="h-full bg-gradient-to-r from-green-500 via-yellow-500 to-red-500"
                style={{
                  width: `${100 - signal.score}%`,
                }}
              />
            </div>
          </section>

          <section className="mt-5 rounded-3xl border border-cyan-900 bg-black p-4">
            <p className="text-xs text-cyan-400">AI LEARNING</p>

            <div className="mt-3 grid grid-cols-2 gap-3">
              <div className="rounded-2xl bg-zinc-900 p-3">
                <p className="text-[10px] text-gray-500">学習補正</p>

                <p className="text-3xl font-black text-cyan-400">
                  +{signal.learningBonus || 0}
                </p>
              </div>

              <div className="rounded-2xl bg-zinc-900 p-3">
                <p className="text-[10px] text-gray-500">AI状態</p>

                <p className="text-3xl font-black text-green-400">ACTIVE</p>
              </div>
            </div>
          </section>

          <section className="mt-5 rounded-3xl border border-zinc-800 bg-black p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500">ローソク足</p>

                <p className="text-lg font-black mt-1">補助チャート</p>
              </div>

              <p className="text-xs text-gray-500">SUB</p>
            </div>

            <div className="mt-4 flex h-28 items-end justify-center gap-[3px] overflow-hidden rounded-2xl bg-zinc-950 p-3">
              {(signal.candles || []).slice(-24).map((candle, index) => {
                const isUp = candle.close >= candle.open;

                const bodyHeight = Math.max(
                  Math.abs(candle.close - candle.open) * 1.5,
                  6
                );

                const wickHeight = Math.max(candle.high - candle.low, 6) * 1.5;

                return (
                  <div key={index} className="flex flex-col items-center">
                    <div
                      className={`w-[1px] ${
                        isUp ? "bg-red-500" : "bg-cyan-400"
                      }`}
                      style={{
                        height: `${wickHeight}px`,
                      }}
                    />

                    <div
                      className={`w-2 rounded-sm ${
                        isUp ? "bg-red-500" : "bg-cyan-400"
                      }`}
                      style={{
                        height: `${bodyHeight}px`,
                        marginTop: "-40%",
                      }}
                    />
                  </div>
                );
              })}
            </div>
          </section>
        </section>
      </div>
    </main>
  );
}