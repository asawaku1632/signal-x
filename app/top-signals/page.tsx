"use client";

import { useEffect, useState } from "react";

type Signal = {
  code: string;
  name: string;
  score: number;
  rsi: number;
  volumeRatio?: number;
  changePercent?: number;
  reason: string;
  patterns?: {
    bullishEngulfing?: boolean;
    rapidRise?: boolean;
    rapidDrop?: boolean;
    rebound?: boolean;

    lowerWickBounce?: boolean;
    upperWickWarning?: boolean;
    volumeBreakout?: boolean;
    highBreak?: boolean;
    goldenCross?: boolean;
    deadCross?: boolean;
    trendFollow?: boolean;
  };
};

export default function TopSignalsPage() {
  const [signals, setSignals] = useState<Signal[]>([]);
  const [loading, setLoading] = useState(true);
  const [openCode, setOpenCode] = useState<string | null>(null);

  const fetchSignals = async () => {
    try {
      const res = await fetch("/api/scan");
      const json = await res.json();

      const stocks: Signal[] = json.stocks || [];

      const ranked = [...stocks]
        .sort((a, b) => b.score - a.score)
        .slice(0, 10);

      setSignals(ranked);
    } catch (error) {
      console.error(error);
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

  const getLabel = (score: number) => {
    if (score >= 85) return "大本命";
    if (score >= 70) return "本命";
    if (score >= 55) return "無理に入るな";
    if (score >= 40) return "静観";
    if (score >= 25) return "危険";
    return "今すぐ撤退";
  };

  const getColor = (score: number) => {
    if (score >= 85) return "border-purple-500 text-purple-300";
    if (score >= 70) return "border-orange-500 text-orange-300";
    if (score >= 55) return "border-cyan-500 text-cyan-300";
    if (score >= 40) return "border-blue-500 text-blue-300";
    if (score >= 25) return "border-yellow-500 text-yellow-300";
    return "border-red-500 text-red-300";
  };

  const patternTexts = (signal: Signal) => {
    const list: string[] = [];

    if (signal.patterns?.bullishEngulfing) list.push("包み線");
    if (signal.patterns?.rapidRise) list.push("急騰");
    if (signal.patterns?.rapidDrop) list.push("急落警戒");
    if (signal.patterns?.rebound) list.push("反発");

    if (signal.patterns?.lowerWickBounce) list.push("下ヒゲ反発");
    if (signal.patterns?.upperWickWarning) list.push("上ヒゲ警戒");
    if (signal.patterns?.volumeBreakout) list.push("出来高急増");
    if (signal.patterns?.highBreak) list.push("高値更新");
    if (signal.patterns?.goldenCross) list.push("GC接近");
    if (signal.patterns?.deadCross) list.push("DC警戒");
    if (signal.patterns?.trendFollow) list.push("トレンド継続");

    return list.length > 0 ? list : ["シグナルなし"];
  };

  return (
    <main className="min-h-screen bg-black text-white p-4 max-w-md mx-auto">
      <section className="rounded-3xl border border-purple-700 bg-zinc-950 p-5">
        <p className="text-xs text-purple-300">SIGNALX SNIPER</p>

        <h1 className="mt-2 text-4xl font-black">大本命ランキング</h1>

        <p className="mt-3 text-sm text-zinc-400">
          一覧は最小表示。タップで詳細確認。
        </p>
      </section>

      {loading && (
        <p className="mt-8 text-center text-zinc-500">AI解析中...</p>
      )}

      <section className="mt-6 space-y-3">
        {signals.map((signal, index) => {
          const isOpen = openCode === signal.code;

          return (
            <button
              key={signal.code}
              onClick={() => setOpenCode(isOpen ? null : signal.code)}
              className={`w-full rounded-3xl border bg-zinc-950 p-4 text-left shadow-xl transition ${getColor(
                signal.score
              )}`}
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs opacity-60">#{index + 1}</p>

                  <h2 className="mt-1 text-2xl font-black">{signal.name}</h2>

                  <p className="mt-1 text-sm opacity-70">CODE {signal.code}</p>

                  <p className="mt-2 text-2xl font-black">
                    {getLabel(signal.score)}
                  </p>
                </div>

                <div className="text-right">
                  <p className="text-[10px] opacity-60">AI POWER</p>

                  <p className="text-5xl font-black">{signal.score}</p>

                  <p className="mt-2 text-xs opacity-50">
                    {isOpen ? "閉じる" : "詳細"}
                  </p>
                </div>
              </div>

              {isOpen && (
                <section className="mt-4 rounded-2xl bg-black/50 p-4 text-zinc-200">
                  <div className="grid grid-cols-3 gap-2">
                    <div className="rounded-xl bg-zinc-900 p-3">
                      <p className="text-[10px] text-zinc-500">RSI</p>
                      <p className="text-xl font-black text-cyan-300">
                        {signal.rsi}
                      </p>
                    </div>

                    <div className="rounded-xl bg-zinc-900 p-3">
                      <p className="text-[10px] text-zinc-500">出来高</p>
                      <p className="text-xl font-black text-orange-300">
                        {signal.volumeRatio ?? "-"}倍
                      </p>
                    </div>

                    <div className="rounded-xl bg-zinc-900 p-3">
                      <p className="text-[10px] text-zinc-500">変化率</p>
                      <p
                        className={`text-xl font-black ${
                          (signal.changePercent || 0) >= 0
                            ? "text-red-300"
                            : "text-blue-300"
                        }`}
                      >
                        {signal.changePercent ?? "-"}%
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 rounded-xl bg-zinc-900 p-3">
                    <p className="text-[10px] text-zinc-500">AI理由</p>

                    <p className="mt-2 text-sm font-bold">{signal.reason}</p>
                  </div>

                  <div className="mt-4 rounded-xl bg-zinc-900 p-3">
                    <p className="text-[10px] text-zinc-500">検出パターン</p>

                    <div className="mt-2 flex flex-wrap gap-2">
                      {patternTexts(signal).map((text) => (
                        <span
                          key={text}
                          className={`rounded-full px-3 py-1 text-xs font-bold ${
                            text.includes("警戒") || text.includes("急落")
                              ? "bg-red-950 text-red-300"
                              : text.includes("高値") ||
                                text.includes("出来高") ||
                                text.includes("GC") ||
                                text.includes("トレンド")
                              ? "bg-purple-950 text-purple-300"
                              : text.includes("シグナルなし")
                              ? "bg-zinc-800 text-zinc-400"
                              : "bg-cyan-950 text-cyan-300"
                          }`}
                        >
                          {text}
                        </span>
                      ))}
                    </div>
                  </div>
                </section>
              )}
            </button>
          );
        })}
      </section>
    </main>
  );
}