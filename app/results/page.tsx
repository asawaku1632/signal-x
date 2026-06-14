"use client";

import { useEffect, useState } from "react";

type Stats = {
  success: boolean;
  total: number;
  judgedTotal: number;
  win: number;
  lose: number;
  hold: number;
  unknown: number;
  winRate: number;
  message: string;
};

type PowerStat = {
  range: string;
  total: number;
  judgedTotal: number;
  win: number;
  lose: number;
  hold: number;
  winRate: number;
};

export default function ResultsPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [powerStats, setPowerStats] = useState<PowerStat[]>([]);
  const [sectorRanking, setSectorRanking] = useState<any[]>([]);

  useEffect(() => {
  fetch("/api/result/stats")
    .then((res) => res.json())
    .then((data) => setStats(data));

  fetch("/api/result/power-stats")
    .then((res) => res.json())
    .then((data) => setPowerStats(data.ranking || []));

  fetch("/api/result/sector-ranking")
    .then((res) => res.json())
    .then((data) => setSectorRanking(data.ranking || []));
}, []);
  if (!stats) {
    return (
      <main className="min-h-screen bg-black text-white p-5">
        読み込み中...
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-black text-white p-5">
      <h1 className="text-3xl font-black mb-6">
        📊 SIGNALX 成績
      </h1>

      <section className="rounded-3xl border border-cyan-500/40 bg-zinc-950 p-5 mb-6">
        <p className="text-zinc-400 text-sm">総通知数</p>
        <p className="text-5xl font-black text-white mb-4">
          {stats.total}件
        </p>

        <div className="grid grid-cols-3 gap-3 mb-5">
          <div className="rounded-2xl bg-zinc-900 p-4 border border-green-500/40">
            <p className="text-green-400 text-sm">勝ち</p>
            <p className="text-3xl font-black">{stats.win}</p>
          </div>

          <div className="rounded-2xl bg-zinc-900 p-4 border border-red-500/40">
            <p className="text-red-400 text-sm">負け</p>
            <p className="text-3xl font-black">{stats.lose}</p>
          </div>

          <div className="rounded-2xl bg-zinc-900 p-4 border border-yellow-500/40">
            <p className="text-yellow-400 text-sm">保留</p>
            <p className="text-3xl font-black">{stats.hold}</p>
          </div>
        </div>

        <div className="rounded-2xl bg-zinc-900 p-5 border border-cyan-400/50">
          <p className="text-zinc-400 text-sm">総合勝率</p>
          <p className="text-5xl font-black text-cyan-400">
            {stats.winRate}%
          </p>
          <p className="text-zinc-400 mt-2">{stats.message}</p>
        </div>
      </section>

      <section className="rounded-3xl border border-orange-500/40 bg-zinc-950 p-5">
        <h2 className="text-2xl font-black text-orange-400 mb-4">
          🔥 AI POWER別勝率
        </h2>

        {powerStats.length === 0 ? (
          <p className="text-zinc-400">
            まだAI POWER別データがありません。
          </p>
        ) : (
          <div className="space-y-3">
            {powerStats.map((item) => (
              <div
                key={item.range}
                className="rounded-2xl bg-zinc-900 p-4 border border-zinc-700"
              >
                <div className="flex justify-between items-center mb-2">
                  <div>
                    <p className="text-xl font-black">
                      AI POWER {item.range}
                    </p>
                    <p className="text-sm text-zinc-400">
                      総数 {item.total}件 / 判定済み{" "}
                      {item.judgedTotal}件
                    </p>
                  </div>

                  <div className="text-right">
                    <p className="text-sm text-zinc-400">勝率</p>
                    <p className="text-3xl font-black text-cyan-400">
                      {item.winRate}%
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 text-sm">
                  <p className="text-green-400">
                    勝ち {item.win}
                  </p>
                  <p className="text-red-400">
                    負け {item.lose}
                  </p>
                  <p className="text-yellow-400">
                    保留 {item.hold}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
      <section className="rounded-3xl border border-yellow-500/40 bg-zinc-950 p-5 mt-6">
  <h2 className="text-2xl font-black text-yellow-400 mb-3">
    🏆 AI勝率ランキング
  </h2>
  <section className="rounded-3xl border border-purple-500/40 bg-zinc-950 p-5 mt-6">
  <h2 className="text-2xl font-black text-purple-400 mb-4">
    🏭 AI得意セクター
  </h2>

  <div className="space-y-3">
    {sectorRanking.slice(0, 5).map((item, index) => (
      <div
        key={item.sector}
        className="rounded-2xl bg-zinc-900 p-4 border border-zinc-700"
      >
        <div className="flex justify-between">
          <div>
            <p className="text-xl font-black">
              {index === 0 && "🥇 "}
              {index === 1 && "🥈 "}
              {index === 2 && "🥉 "}
              {item.sector}
            </p>

            <p className="text-zinc-400 text-sm">
              検証 {item.total}件
            </p>
          </div>

          <div className="text-right">
            <p className="text-cyan-400 text-3xl font-black">
              {item.winRate}%
            </p>
          </div>
        </div>
      </div>
    ))}
  </div>
</section>

  <p className="text-zinc-400 mb-4">
    銘柄ごとの過去実績をランキングで確認できます。
  </p>

  <a
   href="/result-ranking"
    className="block text-center rounded-2xl bg-yellow-400 text-black font-black py-4 text-xl"
  >
    ランキングを見る
  </a>
</section>
    </main>
  );
}