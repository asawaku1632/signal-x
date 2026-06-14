"use client";

import { useEffect, useState } from "react";

type Log = {
  id: string;
  code: string;
  name: string;
  notifiedAt: string;
  price: number;
  currentPrice?: number;
  aiPower: number;
  judge: string;
  takeProfit: number;
  stopLoss: number;
  profitNotified?: boolean;
  stopLossNotified?: boolean;
};

function yen(value?: number) {
  if (value === undefined || value === null) return "-";
  return `${Math.round(value).toLocaleString()}円`;
}

function formatDate(value: string) {
  const date = new Date(value);
  return date.toLocaleString("ja-JP", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function resultLabel(log: Log) {
  if (log.profitNotified) return "🎯 利確達成";
  if (log.stopLossNotified) return "🛡 損切到達";
  return "👀 監視中";
}

function resultColor(log: Log) {
  if (log.profitNotified) return "text-green-400";
  if (log.stopLossNotified) return "text-red-400";
  return "text-yellow-300";
}

function resultProfit(log: Log) {
  if (log.profitNotified) {
    return (log.takeProfit - log.price) * 100;
  }

  if (log.stopLossNotified) {
    return -(log.price - log.stopLoss) * 100;
  }

  const currentPrice = log.currentPrice ?? log.price;
  return (currentPrice - log.price) * 100;
}

export default function HistoryPage() {
  const [logs, setLogs] = useState<Log[]>([]);

  useEffect(() => {
    const fetchLogs = async () => {
      const checkRes = await fetch("/api/check-profit", {
        cache: "no-store",
      });

      const checkJson = await checkRes.json();
      const results = checkJson.results || [];

      const logRes = await fetch("/api/notification-logs", {
        cache: "no-store",
      });

      const logJson = await logRes.json();
      const rawLogs = logJson.logs || [];

      const mergedLogs = rawLogs.map((log: Log) => {
        const result = results.find(
          (item: any) => item.code === log.code
        );

        return {
          ...log,
          currentPrice: result?.currentPrice ?? log.price,
          profitNotified:
            result?.profitNotified ?? log.profitNotified ?? false,
          stopLossNotified:
            result?.stopLossNotified ?? log.stopLossNotified ?? false,
        };
      });

      setLogs(mergedLogs);
    };

    fetchLogs();
  }, []);

  const total = logs.length;
  const wins = logs.filter((log) => log.profitNotified).length;
  const losses = logs.filter((log) => log.stopLossNotified).length;
  const watching = logs.filter(
    (log) => !log.profitNotified && !log.stopLossNotified
  ).length;
  const finished = wins + losses;
  const winRate =
    finished > 0 ? Math.round((wins / finished) * 100) : 0;
  const totalProfit = logs.reduce(
    (sum, log) => sum + resultProfit(log),
    0
  );

  return (
    <main className="min-h-screen bg-black text-white px-4 py-6">
      <div className="mx-auto max-w-md">
        <h1 className="text-2xl font-black text-yellow-300 mb-5">
          📜 SIGNALX 通知履歴
        </h1>

        <section className="mb-5 rounded-3xl border border-yellow-600 bg-zinc-950 p-4 shadow-lg">
          <p className="text-sm font-bold text-yellow-300">
            🏆 SIGNALX 実績
          </p>

          <div className="mt-3 grid grid-cols-2 gap-3">
            <div className="rounded-2xl bg-zinc-900 p-3">
              <p className="text-[11px] text-zinc-400">総通知</p>
              <p className="text-2xl font-black">{total}件</p>
            </div>

            <div className="rounded-2xl bg-zinc-900 p-3">
              <p className="text-[11px] text-zinc-400">勝率</p>
              <p className="text-2xl font-black text-cyan-300">
                {winRate}%
              </p>
            </div>

            <div className="rounded-2xl bg-zinc-900 p-3">
              <p className="text-[11px] text-green-400">🎯 利確</p>
              <p className="text-2xl font-black text-green-400">
                {wins}件
              </p>
            </div>

            <div className="rounded-2xl bg-zinc-900 p-3">
              <p className="text-[11px] text-red-400">🛡 損切</p>
              <p className="text-2xl font-black text-red-400">
                {losses}件
              </p>
            </div>

            <div className="rounded-2xl bg-zinc-900 p-3">
              <p className="text-[11px] text-yellow-300">👀 監視中</p>
              <p className="text-2xl font-black text-yellow-300">
                {watching}件
              </p>
            </div>

            <div className="rounded-2xl bg-zinc-900 p-3">
              <p className="text-[11px] text-zinc-400">累計損益</p>
              <p
                className={`text-2xl font-black ${
                  totalProfit >= 0
                    ? "text-green-400"
                    : "text-red-400"
                }`}
              >
                {totalProfit >= 0 ? "+" : ""}
                {yen(totalProfit)}
              </p>
            </div>
          </div>
        </section>

        {logs.length === 0 && (
          <p className="text-zinc-400">通知履歴はまだありません。</p>
        )}

        <div className="space-y-4">
          {logs.map((log) => {
            const currentPrice = log.currentPrice ?? log.price;
            const profit = resultProfit(log);

            return (
              <div
                key={log.id}
                className="rounded-3xl border border-zinc-700 bg-zinc-950 p-4 shadow-lg"
              >
                <div className="flex justify-between items-start gap-3">
                  <div>
                    <p className="text-xs text-zinc-500">
                      {formatDate(log.notifiedAt)}
                    </p>
                    <p className="mt-1 text-xl font-black">
                      {log.code}{" "}
                      <span className="text-yellow-300">{log.name}</span>
                    </p>
                  </div>

                  <p className={`text-sm font-bold ${resultColor(log)}`}>
                    {resultLabel(log)}
                  </p>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3">
                  <div className="rounded-2xl bg-zinc-900 p-3">
                    <p className="text-[11px] text-zinc-400">通知時</p>
                    <p className="text-lg font-black">{yen(log.price)}</p>
                  </div>

                  <div className="rounded-2xl bg-zinc-900 p-3">
                    <p className="text-[11px] text-zinc-400">現在値</p>
                    <p className="text-lg font-black">
                      {yen(currentPrice)}
                    </p>
                  </div>

                  <div className="rounded-2xl bg-zinc-900 p-3">
                    <p className="text-[11px] text-zinc-400">信頼度</p>
                    <p className="text-lg font-black text-cyan-300">
                      {log.aiPower}%
                    </p>
                  </div>

                  <div className="rounded-2xl bg-zinc-900 p-3">
                    <p className="text-[11px] text-zinc-400">損益</p>
                    <p
                      className={`text-lg font-black ${
                        profit >= 0
                          ? "text-green-400"
                          : "text-red-400"
                      }`}
                    >
                      {profit >= 0 ? "+" : ""}
                      {yen(profit)}
                    </p>
                  </div>

                  <div className="rounded-2xl border border-green-600 bg-zinc-900 p-3">
                    <p className="text-[11px] text-green-400">🎯 利確</p>
                    <p className="text-lg font-black">
                      {yen(log.takeProfit)}
                    </p>
                    <p className="text-sm text-green-400">
                      +{yen((log.takeProfit - log.price) * 100)}
                    </p>
                  </div>

                  <div className="rounded-2xl border border-red-600 bg-zinc-900 p-3">
                    <p className="text-[11px] text-red-400">🛡 損切</p>
                    <p className="text-lg font-black">
                      {yen(log.stopLoss)}
                    </p>
                    <p className="text-sm text-red-400">
                      -{yen((log.price - log.stopLoss) * 100)}
                    </p>
                  </div>
                </div>

                <a
                  href={`/analysis/${log.code}`}
                  className="mt-4 block rounded-2xl bg-cyan-500 py-3 text-center font-black text-black"
                >
                  個別AI解析を見る
                </a>
              </div>
            );
          })}
        </div>
      </div>
    </main>
  );
}