"use client";

import { getAiDecision } from "@/app/lib/aiDecision";
import { getAiFinalJudge } from "@/app/lib/aiFinalJudge";
import { getAiWinRate } from "@/app/lib/aiWinRate";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

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
};

export default function AnalysisPage() {
  const params = useParams();
  const code = String(params.code);

  const [signal, setSignal] = useState<Signal | null>(null);
  const [stocks, setStocks] = useState<Signal[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [resultStats, setResultStats] = useState<any>(null);

  useEffect(() => {
  const fetchSignal = async () => {
    const scanRes = await fetch("/api/scan", {
      cache: "no-store",
    });

    const scanJson = await scanRes.json();
    const allStocks: Signal[] = scanJson.stocks || [];

    let target =
      allStocks.find((item) => item.code === code) || null;

    if (!target) {
      const rankingRes = await fetch("/api/ranking", {
        cache: "no-store",
      });

      const rankingJson = await rankingRes.json();
      const rankingStocks: Signal[] = rankingJson.ranking || [];

      target =
        rankingStocks.find((item) => item.code === code) || null;
    }

    setStocks(allStocks);
    setSignal(target);
  };

  const fetchStats = async () => {
    const res = await fetch("/api/learning/stats");
    setStats(await res.json());
  };

  const fetchResultStats = async () => {
    const res = await fetch(`/api/result/stats/${code}`);
    setResultStats(await res.json());
  };

  fetchSignal();
  fetchStats();
  fetchResultStats();

  const timer = setInterval(() => {
    fetchSignal();
    fetchResultStats();
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
  const requiredMoney = signal.price * 100;
  const profit = (takeProfit - signal.price) * 100;
  const loss = (signal.price - stopLoss) * 100;

  const sortedStocks = stocks
    .slice()
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0));

  const aiRanking =
    sortedStocks.findIndex((item) => item.code === signal.code) + 1;

  const totalRankingStocks = stocks.length || 1000;

  const rankingPercent =
    aiRanking > 0 && totalRankingStocks > 0
      ? Math.round((aiRanking / totalRankingStocks) * 100)
      : 0;

  const resultTotal = resultStats?.total ?? 0;

  const nextLevel =
    resultTotal >= 300
      ? 300
      : resultTotal >= 100
      ? 300
      : resultTotal >= 50
      ? 100
      : resultTotal >= 10
      ? 50
      : 10;

  const currentLevelStart =
    resultTotal >= 300
      ? 300
      : resultTotal >= 100
      ? 100
      : resultTotal >= 50
      ? 50
      : resultTotal >= 10
      ? 10
      : 0;

  const progress =
    nextLevel === currentLevelStart
      ? 100
      : Math.min(
          100,
          Math.round(
            ((resultTotal - currentLevelStart) /
              (nextLevel - currentLevelStart)) *
              100
          )
        );

  const remain = Math.max(0, nextLevel - resultTotal);

  const tradeJudge =
    finalJudge.label === "大本命"
      ? "激熱"
      : finalJudge.label === "本命"
      ? "強い"
      : finalJudge.label === "無理に入るな"
      ? "静観"
      : finalJudge.label === "静観"
      ? "静観"
      : "撤退";

  const tradeColor =
    tradeJudge === "激熱"
      ? "text-purple-400"
      : tradeJudge === "強い"
      ? "text-green-400"
      : tradeJudge === "静観"
      ? "text-yellow-300"
      : "text-red-500";

  const shortReason =
    finalJudge.reasons.length >= 2
      ? `${finalJudge.reasons[0]
          .replace("RSIが良好ゾーン", "RSI良好")
          .replace("値動きは通常範囲", "値動き安定")}｜${finalJudge.reasons[1]
          .replace("RSIが良好ゾーン", "RSI良好")
          .replace("値動きは通常範囲", "値動き安定")}`
      : signal.reason || "AI監視中";

  return (
    <main className="min-h-screen bg-black text-white flex justify-center p-3">
      <div className="w-full max-w-sm">
        <section className="mb-4 rounded-3xl border border-orange-500/70 bg-black p-4 text-center">
          <div className="flex items-center justify-center gap-4">
            <p className={`text-2xl font-black ${tradeColor}`}>
              🟢 {tradeJudge}
            </p>

            <div className="h-7 w-[1px] bg-zinc-700" />

            <p className="text-2xl font-black text-cyan-400">
              信頼度 {signal.score}%
            </p>
          </div>

          <div className="my-4 border-t border-zinc-800" />

          <div className="flex items-center justify-center gap-3">
            <p className="text-4xl font-black text-white">
              {signal.code}
            </p>

            <p className="text-3xl font-black text-yellow-300 truncate">
              {signal.name}
            </p>
          </div>

          <div className="my-4 border-t border-zinc-800" />

          <p className="text-zinc-400 text-sm">現在値</p>

          <p className="mt-1 text-4xl font-black">
            {(signal.price ?? 0).toLocaleString()}円
          </p>

          <p className="mt-2 text-sm text-zinc-400">
            成行100株
            <span className="ml-1 text-yellow-300 font-bold">
              （必要資金 {requiredMoney.toLocaleString()}円）
            </span>
          </p>

          <div className="grid grid-cols-2 gap-3 mt-5">
            <div className="rounded-xl border border-green-500 p-3">
              <p className="text-green-400 font-black text-base">
                🎯 利確
              </p>

              <p className="text-2xl font-black">
                {takeProfit.toLocaleString()}円
              </p>

              <p className="text-green-400 text-xl font-black">
                +{profit.toLocaleString()}円
              </p>
            </div>

            <div className="rounded-xl border border-red-500 p-3">
              <p className="text-red-400 font-black text-base">
                🛡 損切
              </p>

              <p className="text-2xl font-black">
                {stopLoss.toLocaleString()}円
              </p>

              <p className="text-red-400 text-xl font-black">
                -{loss.toLocaleString()}円
              </p>
            </div>
          </div>

          <div className="mt-4 rounded-2xl border border-zinc-700 bg-zinc-950 p-3 text-center">
            <p className="text-lg font-black text-white">
              {shortReason}
            </p>
          </div>
        </section>

        {resultStats && (
          <section className="mb-4 rounded-3xl border border-purple-700 bg-black p-4 text-center">
            <p className="text-xs text-purple-400">AI得意銘柄判定</p>

            <p className="mt-2 text-2xl font-black text-purple-300">
              {resultStats.total < 10
                ? "データ蓄積中"
                : resultStats.winRate >= 80
                ? "超得意銘柄"
                : resultStats.winRate >= 70
                ? "得意銘柄"
                : resultStats.winRate >= 50
                ? "要検証"
                : "苦手候補"}
            </p>

            <p className="mt-1 text-xs text-zinc-400">
              検証 {resultStats.total}回 / 勝率 {resultStats.winRate}%
            </p>
          </section>
        )}

        {resultStats && (
          <section className="mb-4 rounded-3xl border border-cyan-700 bg-black p-4 text-center">
            <p className="text-xs text-cyan-400">AI学習レベル</p>

            <div className="mt-3 rounded-3xl border border-yellow-700 bg-black p-3 text-center">
              <p className="text-xs text-yellow-400">AIランキング</p>

              <p className="mt-2 text-3xl font-black text-yellow-300">
                {aiRanking > 0 ? aiRanking : "-"}位
              </p>

              <p className="mt-1 text-sm font-bold text-zinc-300">
                /{totalRankingStocks}銘柄中
              </p>

              <p className="mt-1 text-xs font-bold text-yellow-200">
                上位 {rankingPercent}%
              </p>
            </div>

            <p className="mt-4 text-2xl font-black text-cyan-300">
              {resultStats.total >= 300
                ? "Lv5 最強AI 👑"
                : resultStats.total >= 100
                ? "Lv4 熟練AI 🏆"
                : resultStats.total >= 50
                ? "Lv3 成長AI 🚀"
                : resultStats.total >= 10
                ? "Lv2 学習中AI 📚"
                : "Lv1 見習いAI 🥚"}
            </p>

            <div className="mt-3">
              <div className="h-3 w-full rounded-full bg-zinc-800 overflow-hidden">
                <div
                  className="h-full bg-cyan-400"
                  style={{ width: `${progress}%` }}
                />
              </div>

              <p className="mt-2 text-xs font-bold text-cyan-300">
                次のレベルまであと {remain} 件
              </p>
            </div>

            <p className="mt-1 text-xs text-zinc-400">
              検証データ {resultStats.total}件
            </p>
          </section>
        )}

        <section className="rounded-3xl border border-zinc-800 bg-zinc-950 p-4 shadow-2xl">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[10px] text-gray-500">
                SIGNALX AI ANALYSIS
              </p>

              <h1 className="mt-1 text-3xl font-black">{signal.name}</h1>

              <p className="mt-1 text-xs text-gray-500">
                CODE {signal.code}
              </p>
            </div>

            <div className="text-right">
              <p className="text-[10px] text-gray-500">AI POWER</p>

              <p className="text-5xl font-black text-cyan-300">
                {signal.score}
              </p>
            </div>
          </div>

          <section
            className={`mt-4 rounded-3xl border ${finalJudge.border} ${finalJudge.bg} p-4`}
          >
            <p className="text-xs text-gray-400">AI FINAL JUDGE</p>

            <p className={`mt-2 text-4xl font-black ${finalJudge.color}`}>
              {finalJudge.label}
            </p>

            <p className="mt-2 text-xl font-black text-white">
              {finalJudge.title}
            </p>

            <p className="mt-1 text-xs text-zinc-300">
              {finalJudge.message}
            </p>
          </section>

          <section
            className={`mt-4 rounded-3xl border ${ai.border} bg-black p-4`}
          >
            <p className="text-xs text-gray-500">AI TRADE DECISION</p>

            <p className={`mt-2 text-2xl font-black ${ai.color}`}>
              {ai.label}
            </p>

            <p className="mt-1 text-sm font-bold text-zinc-200">
              {ai.message}
            </p>
          </section>

          <section className="mt-4 rounded-3xl border border-green-900 bg-black p-4">
            <p className="text-xs text-green-400">AI WIN RATE</p>

            <div className="mt-3 grid grid-cols-2 gap-3">
              <div className="rounded-2xl bg-zinc-900 p-3">
                <p className="text-[10px] text-gray-500">30分後勝率</p>
                <p className="text-2xl font-black text-green-400">
                  {winRate.win30}%
                </p>
              </div>

              <div className="rounded-2xl bg-zinc-900 p-3">
                <p className="text-[10px] text-gray-500">1時間後勝率</p>
                <p className="text-2xl font-black text-cyan-400">
                  {winRate.win60}%
                </p>
              </div>
            </div>
          </section>
        </section>
      </div>
    </main>
  );
}