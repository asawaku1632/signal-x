"use client";

import { useEffect, useState } from "react";

type AlertItem = {
  type: string;
  title: string;
  code?: string;
  name?: string;
  score?: number;
  rank?: number;
  totalRank?: number;
  winRate?: number;
  price?: number;
  priceText?: string;
  requiredCapitalText?: string;
  takeProfitText?: string;
  stopLossText?: string;
  changePercent?: number;
  reason?: string;
  color: string;
};

export default function AlertsPage() {
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatedAt, setUpdatedAt] = useState<string>("");

  const fetchAlerts = async () => {
    try {
      const res = await fetch("/api/alerts", {
        cache: "no-store",
      });

      const json = await res.json();

      setAlerts(json.alerts || []);
      setUpdatedAt(json.updatedAt || "");
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAlerts();

    const timer = setInterval(() => {
      fetchAlerts();
    }, 30000);

    return () => clearInterval(timer);
  }, []);

  return (
    <main className="min-h-screen bg-black text-white p-4 max-w-md mx-auto">
      <section className="rounded-3xl border border-cyan-700 bg-zinc-950 p-5">
        <p className="text-xs text-cyan-400">SIGNALX REAL ALERT</p>

        <h1 className="mt-2 text-4xl font-black">AI通知センター</h1>

        <p className="mt-3 text-sm text-zinc-400">
          AIが重要シグナルだけ通知
        </p>

        {updatedAt && (
          <p className="mt-3 text-xs text-zinc-600">
            最終更新 {new Date(updatedAt).toLocaleTimeString("ja-JP")}
          </p>
        )}
      </section>

      {loading && (
        <p className="mt-8 text-center text-zinc-500">AI監視中...</p>
      )}

      {!loading && alerts.length === 0 && (
        <section className="mt-6 rounded-3xl border border-zinc-700 bg-zinc-900 p-5">
          <h2 className="text-3xl font-black text-zinc-300">
            今日は休もう
          </h2>

          <p className="mt-3 text-sm text-zinc-400">
            現在大きな通知はありません。
          </p>
        </section>
      )}

      <section className="mt-6 space-y-4">
        {alerts.map((alert, index) => {
          const score = alert.score ?? 0;
          const barWidth = Math.max(5, Math.min(100, score));

          return (
            <div
              key={`${alert.title}-${index}`}
              className="rounded-3xl border border-zinc-800 bg-zinc-950 p-5 shadow-2xl"
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className={`text-sm font-bold ${alert.color}`}>
                    {alert.type}
                  </p>

                  <h2 className={`mt-3 text-3xl font-black ${alert.color}`}>
                    {alert.title}
                  </h2>
                </div>

                <div className="text-2xl opacity-60">⚡</div>
              </div>

              <div className="mt-4 space-y-2 text-base font-bold text-white leading-relaxed">
                <p>【現在値】{alert.priceText}</p>
                <p>【必要資金】{alert.requiredCapitalText}</p>
                <p>【信頼度】{score}%</p>
                <p>
                  【AI順位】{alert.rank}位 / {alert.totalRank}銘柄中
                </p>
                <p className="text-cyan-300">
                  【勝率予測】{alert.winRate}%
                </p>
                <p>【利確】{alert.takeProfitText}</p>
                <p>【損切】{alert.stopLossText}</p>
              </div>

              <div className="mt-4 rounded-2xl border border-zinc-800 bg-black/40 p-4">
                <p className="text-sm font-bold text-zinc-400">【理由】</p>
                <p className="mt-2 text-sm font-bold text-zinc-100 leading-relaxed">
                  {alert.reason}
                </p>
              </div>

              <div className="mt-5 h-2 overflow-hidden rounded-full bg-zinc-800">
                <div
                  className={`h-full ${
                    alert.color.includes("red")
                      ? "bg-red-500"
                      : alert.color.includes("green")
                      ? "bg-green-500"
                      : alert.color.includes("purple")
                      ? "bg-purple-500"
                      : alert.color.includes("orange")
                      ? "bg-orange-500"
                      : alert.color.includes("yellow")
                      ? "bg-yellow-500"
                      : "bg-cyan-500"
                  }`}
                  style={{
                    width: `${barWidth}%`,
                  }}
                />
              </div>

              <p className="mt-4 text-xs text-zinc-500">
                SIGNALX REALTIME AI
              </p>
            </div>
          );
        })}
      </section>
    </main>
  );
}