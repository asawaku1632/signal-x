"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

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

type Stats = {
  success: boolean;
  total: number;
  win: number;
  lose: number;
  active: number;
  winRate: number;
};

export default function AlertsPage() {
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [updatedAt, setUpdatedAt] = useState<string>("");
  const [showHotList, setShowHotList] = useState(false);
  const [showStrongList, setShowStrongList] = useState(false);

  const fetchAlerts = async () => {
    try {
      const [alertsRes, statsRes] = await Promise.all([
        fetch("/api/alerts", { cache: "no-store" }),
        fetch("/api/stats", { cache: "no-store" }),
      ]);

      const alertsJson = await alertsRes.json();
      const statsJson = await statsRes.json();

      setAlerts(alertsJson.alerts || []);
      setUpdatedAt(alertsJson.updatedAt || "");
      setStats(statsJson.success ? statsJson : null);
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

  const hotAlerts = useMemo(
    () => alerts.filter((alert) => (alert.score ?? 0) >= 85),
    [alerts]
  );

  const strongAlerts = useMemo(
    () =>
      alerts.filter(
        (alert) => (alert.score ?? 0) >= 70 && (alert.score ?? 0) < 85
      ),
    [alerts]
  );

  const topAlert = alerts[0];

  const openAnalysis = (code?: string) => {
    if (!code) return;
    window.location.href = `/analysis/${code}`;
  };
  return (
    <main className="min-h-screen bg-black text-white px-4 py-3 max-w-lg mx-auto">
      <section className="relative overflow-hidden rounded-[1.6rem] border border-cyan-500/70 bg-gradient-to-br from-zinc-950 via-black to-cyan-950/20 p-3 shadow-[0_0_30px_rgba(34,211,238,0.15)]">
        <div className="absolute right-5 top-5 text-5xl text-cyan-400 opacity-80">
          ⚡
        </div>

        <p className="text-xs font-bold text-cyan-400">
          SIGNALX REAL ALERT
        </p>

        <h1 className="mt-1 text-3xl font-black tracking-tight">
          AI通知センター
        </h1>

        <p className="mt-1 text-xs font-bold text-zinc-400">
          AIが重要シグナルだけ通知
        </p>

        {updatedAt && (
          <p className="mt-2 text-[11px] text-zinc-500">
            最終更新 {new Date(updatedAt).toLocaleTimeString("ja-JP")}
          </p>
        )}
      </section>

      {!loading && stats && (
        <section className="mt-2 rounded-[1.6rem] border border-zinc-700 bg-gradient-to-br from-zinc-950 via-black to-cyan-950/10 p-3 shadow-[0_0_25px_rgba(34,211,238,0.08)]">
          <p className="text-lg font-black text-cyan-400">
            SIGNALX実績
          </p>

          <div className="mt-1 text-center">
            <p className="text-[11px] font-bold text-zinc-400">
              現在の勝率
            </p>

            <p className="mt-0 text-5xl font-black text-cyan-300">
              {stats.winRate}%
            </p>
          </div>

          <div className="mt-2 grid grid-cols-4 overflow-hidden rounded-2xl border border-zinc-800 bg-black/40">
            <div className="border-r border-zinc-800 p-2 text-center">
              <p className="text-[10px] font-bold text-zinc-400">
                総通知
              </p>
              <p className="mt-0 text-2xl font-black text-cyan-300">
                {stats.total}
              </p>
            </div>

            <div className="border-r border-zinc-800 p-2 text-center">
              <p className="text-[10px] font-bold text-zinc-400">
                監視中
              </p>
              <p className="mt-0 text-2xl font-black text-yellow-300">
                {stats.active}
              </p>
            </div>

            <div className="border-r border-zinc-800 p-2 text-center">
              <p className="text-[10px] font-bold text-green-400">
                WIN
              </p>
              <p className="mt-0 text-2xl font-black text-green-400">
                {stats.win}
              </p>
            </div>

            <div className="p-2 text-center">
              <p className="text-[10px] font-bold text-red-400">
                LOSE
              </p>
              <p className="mt-0 text-2xl font-black text-red-400">
                {stats.lose}
              </p>
            </div>
          </div>
        </section>
      )}

      {!loading && topAlert && (
  <section
    onClick={() => openAnalysis(topAlert.code)}
    className="mt-2 cursor-pointer rounded-[1.6rem] border border-yellow-500/80 bg-gradient-to-br from-zinc-950 via-black to-yellow-950/10 p-3 shadow-[0_0_25px_rgba(234,179,8,0.12)]"
  >
    <div className="flex items-center justify-between gap-3">
      <p className="text-lg font-black text-yellow-300">
        👑 本日の大本命
      </p>

      <div className="rounded-full border border-purple-500/80 bg-purple-950/50 px-3 py-1">
        <p className="text-[11px] font-black text-purple-300">
          信頼度 {topAlert.score}%
        </p>
      </div>
    </div>

    <h2 className="mt-3 text-4xl font-black tracking-tight text-white">
      {topAlert.title}
    </h2>

    <div className="mt-3 grid grid-cols-2 gap-3">
      <div>
        <p className="text-[10px] font-bold text-zinc-500">
          AI順位
        </p>
        <p className="mt-0 text-base font-black text-cyan-300">
          {topAlert.rank}位 / {topAlert.totalRank}銘柄中
        </p>
      </div>

      <div>
        <p className="text-[10px] font-bold text-zinc-500">
          勝率予測
        </p>
        <p className="mt-0 text-base font-black text-cyan-300">
          {topAlert.winRate}%
        </p>
      </div>
    </div>

    <div className="mt-3 flex items-center justify-center gap-3 rounded-2xl border border-zinc-700 bg-zinc-950/80 p-2.5">
      <span className="text-lg">📊</span>
      <p className="text-lg font-black text-white">
        詳細解析を見る
      </p>
    </div>
  </section>
)}
      

      {!loading && (
        <section className="mt-3 grid grid-cols-2 gap-3">
          <button
            onClick={() => setShowHotList(true)}
            className="rounded-[1.6rem] border border-purple-600 bg-gradient-to-br from-purple-950/60 via-black to-purple-950/20 p-3 text-left shadow-[0_0_20px_rgba(168,85,247,0.12)]"
          >
            <p className="text-base font-black text-purple-300">
              🔥 激熱候補
            </p>

            <p className="mt-1 text-5xl font-black text-purple-300">
              {hotAlerts.length}件
            </p>

            <div className="mt-2 flex items-center justify-between rounded-2xl border border-purple-700/70 bg-purple-950/30 px-3 py-2">
              <p className="text-xs font-bold text-purple-200">
                一覧を見る
              </p>
              <p className="text-xl text-purple-300">›</p>
            </div>
          </button>

          <button
            onClick={() => setShowStrongList(true)}
            className="rounded-[1.6rem] border border-green-600 bg-gradient-to-br from-green-950/50 via-black to-green-950/20 p-3 text-left shadow-[0_0_20px_rgba(34,197,94,0.12)]"
          >
            <p className="text-base font-black text-green-300">
              🟢 強い候補
            </p>

            <p className="mt-1 text-5xl font-black text-green-300">
              {strongAlerts.length}件
            </p>

            <div className="mt-2 flex items-center justify-between rounded-2xl border border-green-700/70 bg-green-950/30 px-3 py-2">
              <p className="text-xs font-bold text-green-200">
                一覧を見る
              </p>
              <p className="text-xl text-green-300">›</p>
            </div>
          </button>
        </section>
      )}

  {!loading && alerts.length > 0 && (
  <div className="mt-5 rounded-[1.8rem] border border-zinc-800 bg-zinc-950 p-4">
    <h3 className="mb-4 text-lg font-black text-white">
      🏆 TOP3候補
    </h3>

    <div className="space-y-3">
      {alerts.slice(0, 3).map((alert, index) => (
        <div
          key={alert.code}
          onClick={() => openAnalysis(alert.code)}
          className="cursor-pointer rounded-2xl border border-zinc-800 bg-black/40 p-4"
        >
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div
                className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-full text-2xl font-black text-black ${
                  index === 0
                    ? "bg-yellow-400"
                    : index === 1
                    ? "bg-zinc-300"
                    : "bg-orange-500"
                }`}
              >
                {index + 1}
              </div>

              <p className="text-2xl font-black text-white">
                {alert.title}
              </p>
            </div>

            <div className="text-right">
              <p className="text-xs font-bold text-zinc-400">
                信頼度
              </p>

              <p className="text-4xl font-black text-cyan-300">
                {alert.score}%
              </p>
            </div>
          </div>
        </div>
      ))}
    </div>
  </div>
)}

{loading && (
  <p className="mt-8 text-center text-zinc-500">
    AI監視中...
  </p>
)}

      {!loading && alerts.length === 0 && (
        <section className="mt-6 rounded-3xl border border-zinc-700 bg-zinc-900 p-5">
          <h2 className="text-3xl font-black text-zinc-300">今日は休もう</h2>

          <p className="mt-3 text-sm text-zinc-400">
            現在大きな通知はありません。
          </p>
        </section>
      )}

      <section className="mt-5 space-y-4">
        {alerts.map((alert, index) => {
          const score = alert.score ?? 0;
          const barWidth = Math.max(5, Math.min(100, score));

          return (
            <div
              key={`${alert.title}-${index}`}
              onClick={() => openAnalysis(alert.code)}
              className="cursor-pointer rounded-3xl border border-zinc-800 bg-zinc-950 p-5 shadow-2xl"
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

                <div className="h-3" />

                <p>【利確】{alert.takeProfitText}</p>
                <p>【損切】{alert.stopLossText}</p>

                <div className="h-3" />

                <p>【信頼度】{score}%</p>

                <p className="text-cyan-300">
                  【勝率予測】{alert.winRate}%
                </p>

                <p className="text-yellow-300">
                  【AI順位】{alert.rank}位 / {alert.totalRank}銘柄中
                </p>
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
                タップで個別解析へ / SIGNALX REALTIME AI
              </p>
            </div>
          );
        })}
      </section>

      {showHotList && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/80 p-4">
          <div className="mx-auto max-w-md rounded-3xl border border-purple-700 bg-zinc-950 p-5">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-black text-purple-300">
                🔥 激熱候補一覧
              </h2>

              <button
                onClick={() => setShowHotList(false)}
                className="text-2xl font-black text-zinc-400"
              >
                ×
              </button>
            </div>

            <div className="mt-5 space-y-3">
              {hotAlerts.length === 0 && (
                <p className="text-sm text-zinc-500">
                  現在、激熱候補はありません。
                </p>
              )}

              {hotAlerts.map((alert) => (
                <Link
                  key={alert.code}
                  href={`/analysis/${alert.code}`}
                  className="block rounded-2xl border border-purple-700 bg-black/40 p-4"
                >
                  <p className="text-xs text-zinc-500">
                    {alert.rank}位 / {alert.totalRank}銘柄中
                  </p>

                  <p className="mt-1 text-xl font-black text-purple-300">
                    {alert.title}
                  </p>

                  <p className="mt-2 text-sm font-bold text-white">
                    【信頼度】{alert.score}%　【勝率予測】{alert.winRate}%
                  </p>

                  <p className="mt-1 text-xs text-zinc-400">
                    タップで個別解析へ
                  </p>
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}

      {showStrongList && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/80 p-4">
          <div className="mx-auto max-w-md rounded-3xl border border-green-700 bg-zinc-950 p-5">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-black text-green-300">
                🟢 強い候補一覧
              </h2>

              <button
                onClick={() => setShowStrongList(false)}
                className="text-2xl font-black text-zinc-400"
              >
                ×
              </button>
            </div>

            <div className="mt-5 space-y-3">
              {strongAlerts.length === 0 && (
                <p className="text-sm text-zinc-500">
                  現在、強い候補はありません。
                </p>
              )}

              {strongAlerts.map((alert) => (
                <Link
                  key={alert.code}
                  href={`/analysis/${alert.code}`}
                  className="block rounded-2xl border border-green-700 bg-black/40 p-4"
                >
                  <p className="text-xs text-zinc-500">
                    {alert.rank}位 / {alert.totalRank}銘柄中
                  </p>

                  <p className="mt-1 text-xl font-black text-green-300">
                    {alert.title}
                  </p>

                  <p className="mt-2 text-sm font-bold text-white">
                    【信頼度】{alert.score}%　【勝率予測】{alert.winRate}%
                  </p>

                  <p className="mt-1 text-xs text-zinc-400">
                    タップで個別解析へ
                  </p>
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}