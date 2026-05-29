"use client";

import { useEffect, useState } from "react";

type AlertItem = {
  type: string;
  title: string;
  message: string;
  color: string;
};

export default function AlertsPage() {
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAlerts = async () => {
    try {
      const res = await fetch("/api/alerts");

      const json = await res.json();

      setAlerts(json.alerts || []);
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
    }, 5000);

    return () => clearInterval(timer);
  }, []);

  return (
    <main className="min-h-screen bg-black text-white p-4 max-w-md mx-auto">
      <section className="rounded-3xl border border-cyan-700 bg-zinc-950 p-5">
        <p className="text-xs text-cyan-400">
          SIGNALX REAL ALERT
        </p>

        <h1 className="mt-2 text-4xl font-black">
          AI通知センター
        </h1>

        <p className="mt-3 text-sm text-zinc-400">
          AIが重要シグナルだけ通知
        </p>
      </section>

      {loading && (
        <p className="mt-8 text-center text-zinc-500">
          AI監視中...
        </p>
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
        {alerts.map((alert, index) => (
          <div
            key={`${alert.title}-${index}`}
            className={`rounded-3xl border border-zinc-800 bg-zinc-950 p-5 shadow-2xl`}
          >
            <div className="flex items-start justify-between">
              <div>
                <p className={`text-sm font-bold ${alert.color}`}>
                  {alert.type}
                </p>

                <h2
                  className={`mt-3 text-3xl font-black ${alert.color}`}
                >
                  {alert.title}
                </h2>
              </div>

              <div className="text-2xl opacity-60">
                ⚡
              </div>
            </div>

            <p className="mt-4 text-lg font-bold text-white">
              {alert.message}
            </p>

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
                  width: "100%",
                }}
              />
            </div>

            <p className="mt-4 text-xs text-zinc-500">
              SIGNALX REALTIME AI
            </p>
          </div>
        ))}
      </section>
    </main>
  );
}