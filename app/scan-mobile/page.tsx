"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Signal = {
  code: string;
  name: string;
  price: number;
  changePercent: number;
  volumeRatio: number;
  rsi: number;
  score: number;
  reason?: string;
};

export default function ScanMobilePage() {
  const [signals, setSignals] = useState<Signal[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchSignals = async () => {
    try {
      const res = await fetch("/api/scan");
      const json = await res.json();

      const sorted = (json.stocks || []).sort(
        (a: Signal, b: Signal) => b.score - a.score
      );

      setSignals(sorted);
    } catch (error) {
      console.error("取得失敗", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSignals();

    const timer = setInterval(() => {
      fetchSignals();
    }, 5000);

    return () => clearInterval(timer);
  }, []);

  return (
    <main className="min-h-screen bg-black text-white p-4 max-w-md mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-cyan-400">
            SIGNALX MOBILE
          </p>

          <h1 className="text-4xl font-black mt-2">
            AIスキャン
          </h1>
        </div>

        <div className="rounded-2xl border border-cyan-500/30 bg-cyan-500/10 px-4 py-2">
          <p className="text-xs text-cyan-300">
            AI STATUS
          </p>

          <p className="text-lg font-black text-green-400">
            ACTIVE
          </p>
        </div>
      </div>

      <p className="mt-3 text-sm text-zinc-500">
        AIが強い銘柄をリアルタイム監視中
      </p>

      {loading && (
        <p className="mt-10 text-center text-zinc-500">
          AI解析中...
        </p>
      )}

      <section className="mt-6 space-y-4">
        {signals.map((item) => (
          <Link
            href={`/analysis/${item.code}`}
            key={item.code}
            className="block rounded-2xl bg-zinc-900 border border-zinc-800 p-4 shadow-lg transition hover:scale-[1.02]"
          >
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-xl font-black text-white">
                    {item.name}
                  </p>

                  {item.score >= 90 && (
                    <span className="text-xs bg-purple-500 text-white px-2 py-1 rounded-full">
                      ULTIMATE
                    </span>
                  )}

                  {item.score >= 70 && item.score < 90 && (
                    <span className="text-xs bg-red-500 text-white px-2 py-1 rounded-full">
                      STRONG
                    </span>
                  )}
                </div>

                <p className="text-xs text-gray-500 mt-1">
                  CODE {item.code}
                </p>

                <p className="text-sm text-yellow-300 mt-2">
                  {item.reason || "AI解析中"}
                </p>
              </div>

              <div className="text-right">
                <p className="text-[10px] text-gray-500">
                  AI POWER
                </p>

                <p
                  className={`text-5xl font-black ${
                    item.score >= 90
                      ? "text-purple-400"
                      : item.score >= 70
                      ? "text-red-400"
                      : item.score >= 50
                      ? "text-cyan-300"
                      : "text-gray-500"
                  }`}
                >
                  {item.score}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 mt-4">
              <div className="rounded-xl bg-black/40 p-3">
                <p className="text-[10px] text-gray-500">
                  RSI
                </p>

                <p className="text-xl font-black text-cyan-400">
                  {item.rsi}
                </p>
              </div>

              <div className="rounded-xl bg-black/40 p-3">
                <p className="text-[10px] text-gray-500">
                  出来高
                </p>

                <p className="text-xl font-black text-orange-400">
                  {item.volumeRatio}x
                </p>
              </div>

              <div className="rounded-xl bg-black/40 p-3">
                <p className="text-[10px] text-gray-500">
                  変化率
                </p>

                <p
                  className={`text-xl font-black ${
                    item.changePercent >= 0
                      ? "text-red-400"
                      : "text-blue-400"
                  }`}
                >
                  {item.changePercent}%
                </p>
              </div>
            </div>

            <div className="mt-4">
              <div className="h-3 overflow-hidden rounded-full bg-zinc-800">
                <div
                  className={`h-full ${
                    item.score >= 90
                      ? "bg-gradient-to-r from-purple-500 to-pink-500"
                      : item.score >= 70
                      ? "bg-gradient-to-r from-red-500 to-orange-500"
                      : item.score >= 50
                      ? "bg-gradient-to-r from-cyan-500 to-blue-500"
                      : "bg-gradient-to-r from-zinc-600 to-zinc-500"
                  }`}
                  style={{
                    width: `${Math.min(item.score, 100)}%`,
                  }}
                />
              </div>
            </div>

            <div className="mt-4 text-center text-xs text-cyan-400">
              TAP TO OPEN AI ANALYSIS →
            </div>
          </Link>
        ))}
      </section>
    </main>
  );
}