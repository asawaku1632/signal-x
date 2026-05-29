"use client";

import { useEffect, useState } from "react";

type BacktestItem = {
  reason: string;
  total: number;
  win: number;
  lose: number;
  winRate: number;
  avgProfitRate: number;
  maxProfitRate: number;
  minProfitRate: number;
};

export default function BacktestPage() {
  const [data, setData] = useState<BacktestItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchStats = async () => {
    try {
      const res = await fetch("/api/history/stats");
      const result = await res.json();

      const sorted = (result.data || []).sort(
        (a: BacktestItem, b: BacktestItem) =>
          b.winRate + b.avgProfitRate - (a.winRate + a.avgProfitRate)
      );

      setData(sorted);
    } catch (error) {
      console.error("バックテスト取得失敗", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  const bestTime = data[0];

  const getAiJudge = (winRate: number, avgProfitRate: number) => {
    if (winRate >= 75 && avgProfitRate > 0) return "最強候補";
    if (winRate >= 60 && avgProfitRate > 0) return "有力";
    if (winRate >= 50) return "普通";
    return "弱い";
  };

  const getJudgeColor = (winRate: number, avgProfitRate: number) => {
    if (winRate >= 75 && avgProfitRate > 0) return "text-purple-400";
    if (winRate >= 60 && avgProfitRate > 0) return "text-red-400";
    if (winRate >= 50) return "text-orange-400";
    return "text-gray-500";
  };

  return (
    <main className="min-h-screen bg-black text-white p-4 max-w-md mx-auto">
      <h1 className="text-2xl font-black">SIGNALXバックテスト</h1>

      <p className="text-xs text-gray-400 mt-1">
        保存されたシグナル結果から戦法別の勝率と損益率を分析
      </p>

      {loading && (
        <p className="text-sm text-gray-500 mt-6">読み込み中...</p>
      )}

      {!loading && data.length === 0 && (
        <p className="text-sm text-gray-500 mt-6">
          まだバックテスト用データがありません
        </p>
      )}

      {bestTime && (
        <div className="mt-6 mb-6 rounded-3xl border border-yellow-500 bg-gradient-to-br from-yellow-500/20 to-orange-500/10 p-5 shadow-2xl">
          <p className="text-xs text-yellow-300 font-bold">
            🔥 TODAY BEST STRATEGY
          </p>

          <div className="mt-3 flex items-center justify-between">
            <div>
              <p className="text-2xl font-black text-white">
                {bestTime.reason}
              </p>

              <p className="mt-2 text-sm text-zinc-300">
                AIが最も強いと判断した戦法
              </p>
            </div>

            <div className="text-right">
              <p className="text-xs text-zinc-400">AI POWER</p>

              <p className="text-5xl font-black text-yellow-300">
                {Math.min(
                  100,
                  Math.round(bestTime.winRate + bestTime.avgProfitRate)
                )}
              </p>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-3 gap-3">
            <div className="rounded-2xl bg-black/40 p-3">
              <p className="text-[10px] text-zinc-500">勝率</p>

              <p className="text-2xl font-black text-green-400">
                {bestTime.winRate}%
              </p>
            </div>

            <div className="rounded-2xl bg-black/40 p-3">
              <p className="text-[10px] text-zinc-500">平均利益</p>

              <p className="text-2xl font-black text-cyan-400">
                {bestTime.avgProfitRate}%
              </p>
            </div>

            <div className="rounded-2xl bg-black/40 p-3">
              <p className="text-[10px] text-zinc-500">成功数</p>

              <p className="text-2xl font-black text-pink-400">
                {bestTime.win}
              </p>
            </div>
          </div>
        </div>
      )}

      <section className="mt-6 space-y-4">
        {data.map((item, index) => (
          <div
            key={`${item.reason}-${index}`}
            className="rounded-2xl bg-zinc-900 border border-zinc-800 p-4"
          >
            <div className="flex justify-between gap-3">
              <div>
                <p className="text-sm text-gray-500">戦法</p>
                <h2 className="text-lg font-black">{item.reason}</h2>
              </div>

              <div className="text-right">
                <p className="text-sm text-gray-500">勝率</p>
                <p className="text-3xl font-black text-green-400">
                  {item.winRate}%
                </p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 mt-4 text-center">
              <div className="bg-black/40 rounded-xl p-3">
                <p className="text-[10px] text-gray-500">総数</p>
                <p className="text-xl font-black">{item.total}</p>
              </div>

              <div className="bg-black/40 rounded-xl p-3">
                <p className="text-[10px] text-gray-500">成功</p>
                <p className="text-xl font-black text-red-400">{item.win}</p>
              </div>

              <div className="bg-black/40 rounded-xl p-3">
                <p className="text-[10px] text-gray-500">失敗</p>
                <p className="text-xl font-black text-blue-400">{item.lose}</p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 mt-4 text-center">
              <div className="bg-black/40 rounded-xl p-3">
                <p className="text-[10px] text-gray-500">平均利益</p>
                <p
                  className={`text-lg font-black ${
                    item.avgProfitRate >= 0
                      ? "text-green-400"
                      : "text-red-400"
                  }`}
                >
                  {item.avgProfitRate}%
                </p>
              </div>

              <div className="bg-black/40 rounded-xl p-3">
                <p className="text-[10px] text-gray-500">最大利益</p>
                <p className="text-lg font-black text-green-400">
                  {item.maxProfitRate}%
                </p>
              </div>

              <div className="bg-black/40 rounded-xl p-3">
                <p className="text-[10px] text-gray-500">最大損失</p>
                <p className="text-lg font-black text-red-400">
                  {item.minProfitRate}%
                </p>
              </div>
            </div>

            <div className="mt-4 rounded-xl bg-purple-950/40 border border-purple-800 p-3">
              <p className="text-[10px] text-purple-300">AI評価</p>

              <p
                className={`text-lg font-black ${getJudgeColor(
                  item.winRate,
                  item.avgProfitRate
                )}`}
              >
                {getAiJudge(item.winRate, item.avgProfitRate)}
              </p>
            </div>
          </div>
        ))}
      </section>
    </main>
  );
}