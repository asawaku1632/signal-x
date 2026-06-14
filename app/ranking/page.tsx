"use client";

import { useEffect, useState } from "react";

type Stock = {
  code: string;
  name: string;
  score: number;
  price: number;
  changePercent?: number;
  rsi?: number;
  volumeRatio?: number;
  reason?: string;
  takeProfit?: number;
  stopLoss?: number;
};

function yen(value?: number) {
  if (value === undefined || value === null) return "-";
  return `${Math.round(value).toLocaleString()}円`;
}

function judge(score = 0) {
  if (score >= 95) return "👑 大本命";
  if (score >= 85) return "🔥 激熱";
  if (score >= 70) return "🟢 強い";
  if (score >= 50) return "🟡 静観";
  return "🔴 見送り";
}

function rankLabel(index: number) {
  if (index === 0) return "🥇 1位";
  if (index === 1) return "🥈 2位";
  if (index === 2) return "🥉 3位";
  return `${index + 1}位`;
}

function scoreColor(score = 0) {
  if (score >= 95) return "text-yellow-300";
  if (score >= 85) return "text-red-400";
  if (score >= 70) return "text-green-400";
  if (score >= 50) return "text-yellow-300";
  return "text-zinc-400";
}

export default function RankingPage() {
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchRanking = async () => {
      try {
        const res = await fetch("/api/ranking", {
          cache: "no-store",
        });

        const json = await res.json();
        setStocks(json.ranking || []);
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };

    fetchRanking();
  }, []);

  const topStock = stocks[0];

  return (
    <main className="min-h-screen bg-black text-white px-4 py-6">
      <div className="mx-auto max-w-md">
        <h1 className="text-2xl font-black text-yellow-300">
          🏆 SIGNALX AIランキング
        </h1>

        <p className="mt-1 text-sm text-zinc-400">
          AI POWER順に本日の有力候補を表示
        </p>

        {loading && (
          <p className="mt-6 text-zinc-400">ランキング取得中...</p>
        )}

        {!loading && stocks.length === 0 && (
          <p className="mt-6 text-zinc-400">
            現在ランキング対象はありません。
          </p>
        )}

        {topStock && (
          <section className="mt-5 rounded-3xl border border-yellow-500 bg-zinc-950 p-4 shadow-lg">
            <p className="text-sm font-black text-yellow-300">
              👑 本日の最有力
            </p>

            <div className="mt-3 flex items-start justify-between gap-3">
              <div>
                <p className="text-3xl font-black">
                  {topStock.code}
                </p>
                <p className="text-xl font-black text-yellow-300">
                  {topStock.name}
                </p>
              </div>

              <div className="text-right">
                <p className="text-xs text-zinc-400">信頼度</p>
                <p
                  className={`text-4xl font-black ${scoreColor(
                    topStock.score
                  )}`}
                >
                  {topStock.score}%
                </p>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="rounded-2xl bg-zinc-900 p-3">
                <p className="text-[11px] text-zinc-400">判定</p>
                <p className="text-lg font-black">
                  {judge(topStock.score)}
                </p>
              </div>

              <div className="rounded-2xl bg-zinc-900 p-3">
                <p className="text-[11px] text-zinc-400">現在値</p>
                <p className="text-lg font-black">
                  {yen(topStock.price)}
                </p>
              </div>

              <div className="rounded-2xl bg-zinc-900 p-3">
                <p className="text-[11px] text-zinc-400">成行100株</p>
                <p className="text-lg font-black text-yellow-300">
                  {yen(topStock.price * 100)}
                </p>
              </div>

              <div className="rounded-2xl bg-zinc-900 p-3">
                <p className="text-[11px] text-zinc-400">変化率</p>
                <p className="text-lg font-black">
                  {topStock.changePercent ?? "-"}%
                </p>
              </div>

              <div className="rounded-2xl border border-green-600 bg-zinc-900 p-3">
                <p className="text-[11px] text-green-400">🎯 利確</p>
                <p className="text-lg font-black">
                  {yen(topStock.takeProfit)}
                </p>
                <p className="text-sm text-green-400">
                  +{yen(
                    ((topStock.takeProfit ?? topStock.price) -
                      topStock.price) *
                      100
                  )}
                </p>
              </div>

              <div className="rounded-2xl border border-red-600 bg-zinc-900 p-3">
                <p className="text-[11px] text-red-400">🛡 損切</p>
                <p className="text-lg font-black">
                  {yen(topStock.stopLoss)}
                </p>
                <p className="text-sm text-red-400">
                  -{yen(
                    (topStock.price -
                      (topStock.stopLoss ?? topStock.price)) *
                      100
                  )}
                </p>
              </div>
            </div>

            <p className="mt-4 rounded-2xl bg-zinc-900 p-3 text-sm text-zinc-300">
              {topStock.reason || "AI理由なし"}
            </p>

            <a
              href={`/analysis/${topStock.code}`}
              className="mt-4 block rounded-2xl bg-cyan-500 py-3 text-center font-black text-black"
            >
              個別AI解析を見る
            </a>
          </section>
        )}

        <section className="mt-5 space-y-3">
          {stocks.map((stock, index) => (
            <a
              key={`${stock.code}-${index}`}
              href={`/analysis/${stock.code}`}
              className="block rounded-3xl border border-zinc-700 bg-zinc-950 p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-black text-yellow-300">
                    {rankLabel(index)}
                  </p>
                  <p className="mt-1 text-2xl font-black">
                    {stock.code}{" "}
                    <span className="text-yellow-300">
                      {stock.name}
                    </span>
                  </p>
                  <p className="mt-1 text-sm text-zinc-400">
                    {judge(stock.score)}
                  </p>
                </div>

                <div className="text-right">
                  <p className="text-xs text-zinc-400">信頼度</p>
                  <p
                    className={`text-3xl font-black ${scoreColor(
                      stock.score
                    )}`}
                  >
                    {stock.score}%
                  </p>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-3 gap-2">
                <div className="rounded-2xl bg-zinc-900 p-3">
                  <p className="text-[10px] text-zinc-400">現在値</p>
                  <p className="text-sm font-black">{yen(stock.price)}</p>
                </div>

                <div className="rounded-2xl bg-zinc-900 p-3">
                  <p className="text-[10px] text-zinc-400">100株</p>
                  <p className="text-sm font-black text-yellow-300">
                    {yen(stock.price * 100)}
                  </p>
                </div>

                <div className="rounded-2xl bg-zinc-900 p-3">
                  <p className="text-[10px] text-zinc-400">変化率</p>
                  <p className="text-sm font-black">
                    {stock.changePercent ?? "-"}%
                  </p>
                </div>
              </div>

              <p className="mt-3 text-xs text-zinc-400">
                {stock.reason || "AI理由なし"}
              </p>
            </a>
          ))}
        </section>
      </div>
    </main>
  );
}