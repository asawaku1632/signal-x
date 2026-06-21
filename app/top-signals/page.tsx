"use client";

import { useEffect, useState } from "react";

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

export default function TopSignalsPage() {
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [loading, setLoading] = useState(true);

  async function fetchRanking() {
    try {
      const res = await fetch("/api/scan?limit=1000", {
        cache: "no-store",
      });

      const json = await res.json();
      setStocks(json.stocks || []);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchRanking();
  }, []);

  function judgeLabel(score: number) {
    if (score >= 85) return "激熱";
    if (score >= 70) return "本命";
    if (score >= 50) return "静観";
    return "見送り";
  }

  function medal(index: number) {
    if (index === 0) return "🥇";
    if (index === 1) return "🥈";
    if (index === 2) return "🥉";
    return `#${index + 1}`;
  }

  return (
    <main className="min-h-screen bg-black p-4 text-white">
      <div className="mx-auto max-w-md space-y-4">
        <section className="rounded-3xl border border-purple-500 bg-zinc-950 p-5">
          <p className="text-sm font-bold text-purple-300">
            SIGNALX SNIPER
          </p>

          <h1 className="mt-2 text-4xl font-black">
            大本命ランキング
          </h1>

          <p className="mt-3 text-sm font-bold text-zinc-400">
            タップで個別解析へ
          </p>
        </section>

        {loading && (
          <p className="mt-8 text-center text-zinc-500">
            AIランキング取得中...
          </p>
        )}

        {!loading && (
          <section className="space-y-3">
            {stocks.slice(0, 30).map((stock, index) => (
              <a
                key={`${stock.code}-${index}`}
                href={`/analysis/${stock.code}`}
                className={`block rounded-3xl border p-5 ${
                  index < 3
                    ? "border-orange-500 bg-zinc-950"
                    : "border-zinc-800 bg-zinc-950"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-black text-yellow-300">
                      {medal(index)}
                    </p>

                    <p className="mt-2 text-4xl font-black text-yellow-300">
                      {stock.code}
                    </p>

                    <p className="mt-1 text-3xl font-black text-white">
                      {stock.name}
                    </p>

                    <p className="mt-3 text-2xl font-black text-yellow-300">
                      {judgeLabel(stock.score)}
                    </p>
                  </div>

                  <div className="text-right">
                    <p className="text-xs font-bold text-zinc-400">
                      AI POWER
                    </p>

                    <p className="text-5xl font-black text-yellow-300">
                      {stock.score}
                    </p>
                  </div>
                </div>

                <div className="mt-5 grid grid-cols-3 gap-2">
                  <div className="rounded-2xl bg-zinc-900 p-3">
                    <p className="text-xs text-zinc-400">RSI</p>
                    <p className="text-xl font-black text-cyan-300">
                      {stock.rsi}
                    </p>
                  </div>

                  <div className="rounded-2xl bg-zinc-900 p-3">
                    <p className="text-xs text-zinc-400">出来高</p>
                    <p className="text-xl font-black text-yellow-300">
                      {stock.volumeRatio}倍
                    </p>
                  </div>

                  <div className="rounded-2xl bg-zinc-900 p-3">
                    <p className="text-xs text-zinc-400">変化率</p>
                    <p
                      className={`text-xl font-black ${
                        stock.changePercent >= 0
                          ? "text-green-400"
                          : "text-red-400"
                      }`}
                    >
                      {stock.changePercent}%
                    </p>
                  </div>
                </div>

                <div className="mt-4 rounded-2xl bg-zinc-900 p-4">
                  <p className="text-xs text-zinc-400">AI理由</p>
                  <p className="mt-1 text-sm font-bold text-white">
                    {stock.reason}
                  </p>
                </div>

                <p className="mt-4 text-right text-xs font-bold text-zinc-500">
                  タップで個別解析 →
                </p>
              </a>
            ))}
          </section>
        )}
      </div>
    </main>
  );
}