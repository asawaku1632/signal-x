"use client";

import { useEffect, useState } from "react";

type PatternItem = {
  key: string;
  label: string;
  description: string;
  count: number;
  avgScore: number;
  maxScore: number;
  strongestStock?: string;
};

type Signal = {
  name: string;
  score: number;
  patterns?: {
    bullishEngulfing?: boolean;
    rapidRise?: boolean;
    rapidDrop?: boolean;
    rebound?: boolean;
  };
};

const PATTERNS = [
  {
    key: "bullishEngulfing",
    label: "包み線",
    description: "反転上昇の可能性",
  },
  {
    key: "rapidRise",
    label: "急騰",
    description: "短期で強い上昇",
  },
  {
    key: "rapidDrop",
    label: "急落",
    description: "下落警戒",
  },
  {
    key: "rebound",
    label: "反発",
    description: "下落後の戻り候補",
  },
];

export default function PatternRankingPage() {
  const [data, setData] = useState<PatternItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchPatterns = async () => {
    try {
      const res = await fetch("/api/scan");
      const json = await res.json();

      const signals: Signal[] = json.stocks || [];

      const ranked = PATTERNS.map((pattern) => {
        const matched = signals.filter(
          (item) =>
            item.patterns?.[
              pattern.key as keyof Signal["patterns"]
            ]
        );

        const count = matched.length;

        const avgScore =
          count > 0
            ? Number(
                (
                  matched.reduce(
                    (sum, item) => sum + item.score,
                    0
                  ) / count
                ).toFixed(1)
              )
            : 0;

        const maxScore =
          count > 0
            ? Math.max(...matched.map((item) => item.score))
            : 0;

        const strongest =
          count > 0
            ? [...matched].sort((a, b) => b.score - a.score)[0]
            : undefined;

        return {
          ...pattern,
          count,
          avgScore,
          maxScore,
          strongestStock: strongest?.name,
        };
      }).sort((a, b) => b.avgScore - a.avgScore);

      setData(ranked);
    } catch (error) {
      console.error("パターンランキング取得失敗", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPatterns();

    const timer = setInterval(() => {
      fetchPatterns();
    }, 5000);

    return () => clearInterval(timer);
  }, []);

  const getColor = (item: PatternItem) => {
    if (item.key === "rapidDrop") {
      return "border-red-600 bg-red-950/30 text-red-300";
    }

    if (item.avgScore >= 80) {
      return "border-purple-500 bg-purple-950/40 text-purple-300";
    }

    if (item.avgScore >= 65) {
      return "border-orange-500 bg-orange-950/30 text-orange-300";
    }

    return "border-zinc-700 bg-zinc-900 text-zinc-300";
  };

  const getJudge = (item: PatternItem) => {
    if (item.count === 0) return "未検出";
    if (item.key === "rapidDrop") return "警戒";
    if (item.avgScore >= 80) return "大本命級";
    if (item.avgScore >= 65) return "本命候補";
    return "監視";
  };

  return (
    <main className="min-h-screen bg-black text-white p-4 max-w-md mx-auto">
      <h1 className="text-3xl font-black">パターンAIランキング</h1>

      <p className="text-xs text-gray-400 mt-1">
        本物ローソク足から検出したパターンをAI評価
      </p>

      {loading && (
        <p className="text-sm text-gray-500 mt-6">AI解析中...</p>
      )}

      <section className="mt-6 space-y-4">
        {data.map((item, index) => (
          <div
            key={item.key}
            className={`rounded-3xl border p-5 shadow-2xl ${getColor(
              item
            )}`}
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-2xl font-black">#{index + 1}</p>

                <h2 className="mt-2 text-3xl font-black">
                  {item.label}
                </h2>

                <p className="mt-2 text-sm opacity-80">
                  {item.description}
                </p>
              </div>

              <div className="text-right">
                <p className="text-[10px] opacity-70">AI評価</p>

                <p className="text-2xl font-black">
                  {getJudge(item)}
                </p>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-3 gap-2">
              <div className="rounded-2xl bg-black/40 p-3">
                <p className="text-[10px] opacity-60">検出数</p>
                <p className="text-2xl font-black">{item.count}</p>
              </div>

              <div className="rounded-2xl bg-black/40 p-3">
                <p className="text-[10px] opacity-60">平均</p>
                <p className="text-2xl font-black">{item.avgScore}</p>
              </div>

              <div className="rounded-2xl bg-black/40 p-3">
                <p className="text-[10px] opacity-60">最大</p>
                <p className="text-2xl font-black">{item.maxScore}</p>
              </div>
            </div>

            <div className="mt-4 rounded-2xl bg-black/40 p-3">
              <p className="text-[10px] opacity-60">最強銘柄</p>
              <p className="text-lg font-black">
                {item.strongestStock || "なし"}
              </p>
            </div>

            <div className="mt-4 h-3 overflow-hidden rounded-full bg-black/50">
              <div
                className="h-full bg-gradient-to-r from-purple-500 to-pink-500"
                style={{
                  width: `${Math.min(item.avgScore, 100)}%`,
                }}
              />
            </div>
          </div>
        ))}
      </section>
    </main>
  );
}