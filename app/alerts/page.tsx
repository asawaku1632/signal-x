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
  color?: string;
};

type Stats = {
  success: boolean;
  total: number;
  win: number;
  lose: number;
  active: number;
  winRate: number;
};

function getAlertId(alert: AlertItem, index: number) {
  return `${alert.code ?? "market"}-${alert.type}-${alert.title}-${index}`;
}

function getScore(alert: AlertItem) {
  return alert.score ?? 0;
}

function getAlertRank(score: number) {
  if (score >= 85) return "激熱";
  if (score >= 70) return "強い";
  if (score >= 50) return "注目";
  return "様子見";
}

function getRankBadge(score: number) {
  if (score >= 85) return "bg-purple-100 text-purple-700 border-purple-200";
  if (score >= 70) return "bg-green-100 text-green-700 border-green-200";
  if (score >= 50) return "bg-blue-100 text-blue-700 border-blue-200";
  return "bg-slate-100 text-slate-700 border-slate-200";
}

function getTypeIcon(type?: string) {
  if (!type) return "🔔";
  if (type.includes("激熱")) return "🔥";
  if (type.includes("強い")) return "🟢";
  if (type.includes("利確")) return "🎯";
  if (type.includes("損切")) return "⚠️";
  if (type.includes("大本命")) return "👑";
  return "🔔";
}

function createAiReasons(alert: AlertItem) {
  const score = alert.score ?? 0;
  const winRate = alert.winRate ?? 0;
  const rank = alert.rank ?? 9999;
  const changePercent = alert.changePercent ?? 0;

  const reasons: string[] = [];

  if (score >= 85) {
    reasons.push("AI信頼度が非常に高い");
  } else if (score >= 70) {
    reasons.push("AI信頼度が高い");
  } else if (score >= 50) {
    reasons.push("AIが注目している");
  }

  if (winRate >= 75) {
    reasons.push("勝率予測が高い");
  } else if (winRate >= 60) {
    reasons.push("勝率予測は良好");
  }

  if (rank <= 10) {
    reasons.push("AIランキングTOP10入り");
  } else if (rank <= 50) {
    reasons.push("AIランキング上位");
  }

  if (changePercent >= 3) {
    reasons.push("本日の上昇率が強い");
  } else if (changePercent > 0) {
    reasons.push("上昇基調を維持");
  }

  if (alert.priceText && alert.requiredCapitalText) {
    reasons.push("現在値と必要資金を確認済み");
  }

  if (alert.takeProfitText && alert.stopLossText) {
    reasons.push("利確ラインと損切ラインが明確");
  }

  if (alert.reason) {
    reasons.push(alert.reason);
  }

  return Array.from(new Set(reasons)).slice(0, 6);
}

export default function AlertsPage() {
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [updatedAt, setUpdatedAt] = useState("");
  const [readIds, setReadIds] = useState<string[]>([]);
  const [favoriteCodes, setFavoriteCodes] = useState<string[]>([]);
  const [filter, setFilter] = useState<"all" | "unread" | "favorite">("all");

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
      console.error("alerts fetch error:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadLocalData = () => {
    const savedRead = localStorage.getItem("signalx-read-alerts");
    const savedFavorites = localStorage.getItem("signalx-favorites");

    setReadIds(savedRead ? JSON.parse(savedRead) : []);
    setFavoriteCodes(savedFavorites ? JSON.parse(savedFavorites) : []);
  };

  useEffect(() => {
    loadLocalData();
    fetchAlerts();

    const timer = setInterval(() => {
      fetchAlerts();
      loadLocalData();
    }, 30000);

    return () => clearInterval(timer);
  }, []);

  const unreadCount = useMemo(() => {
    return alerts.filter((alert, index) => {
      const id = getAlertId(alert, index);
      return !readIds.includes(id);
    }).length;
  }, [alerts, readIds]);

  const filteredAlerts = useMemo(() => {
    return alerts.filter((alert, index) => {
      const id = getAlertId(alert, index);

      if (filter === "unread") {
        return !readIds.includes(id);
      }

      if (filter === "favorite") {
        return alert.code ? favoriteCodes.includes(alert.code) : false;
      }

      return true;
    });
  }, [alerts, readIds, favoriteCodes, filter]);

  const topAlert = alerts[0];

  const markAsRead = (id: string) => {
    if (readIds.includes(id)) return;

    const updated = [...readIds, id];
    setReadIds(updated);
    localStorage.setItem("signalx-read-alerts", JSON.stringify(updated));
  };

  const markAllAsRead = () => {
    const allIds = alerts.map((alert, index) => getAlertId(alert, index));
    setReadIds(allIds);
    localStorage.setItem("signalx-read-alerts", JSON.stringify(allIds));
  };

  const openAnalysis = (alert: AlertItem, index: number) => {
    const id = getAlertId(alert, index);
    markAsRead(id);

    if (alert.code) {
      window.location.href = `/analysis/${alert.code}`;
    }
  };

  return (
    <main className="min-h-screen bg-[#f7f9fc] text-slate-900 pb-24">
      <div className="mx-auto max-w-md px-4 pt-4">
        <header className="flex items-center justify-between mb-4">
          <Link
            href="/"
            className="w-11 h-11 rounded-2xl bg-white shadow flex items-center justify-center text-2xl"
          >
            ‹
          </Link>

          <div className="text-center">
            <div className="text-3xl font-black">
              SIGNAL<span className="text-blue-600">X</span>
            </div>
            <div className="text-xs font-black tracking-[0.22em] text-slate-500">
              AI ALERT
            </div>
          </div>

          <button
            onClick={fetchAlerts}
            className="w-11 h-11 rounded-2xl bg-white shadow flex items-center justify-center text-lg"
          >
            ↻
          </button>
        </header>

        <section className="rounded-[24px] bg-gradient-to-br from-white to-yellow-50 border border-yellow-200 p-4 mb-4 shadow-sm">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-black text-yellow-600">
                🔔 AI通知センター
              </p>
              <h1 className="text-5xl font-black mt-2">{unreadCount}</h1>
              <p className="text-sm font-bold text-slate-500 mt-1">
                未読通知
              </p>
            </div>

            <div className="text-right">
              <p className="text-xs font-black text-slate-500">更新</p>
              <p className="text-sm font-black text-slate-700">
                {updatedAt
                  ? new Date(updatedAt).toLocaleTimeString("ja-JP", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })
                  : "--:--"}
              </p>
            </div>
          </div>

          <button
            onClick={markAllAsRead}
            className="mt-4 w-full rounded-2xl bg-yellow-400 text-white py-3 font-black active:scale-[0.98] transition"
          >
            すべて既読にする
          </button>
        </section>

        {stats && (
          <section className="rounded-[24px] bg-white border border-slate-200 p-4 mb-4 shadow-sm">
            <h2 className="text-xl font-black mb-3">📊 SIGNALX実績</h2>

            <div className="grid grid-cols-4 gap-2">
              <Mini label="通知" value={`${stats.total}`} color="text-blue-600" />
              <Mini label="監視" value={`${stats.active}`} color="text-yellow-600" />
              <Mini label="WIN" value={`${stats.win}`} color="text-green-600" />
              <Mini label="LOSE" value={`${stats.lose}`} color="text-red-500" />
            </div>

            <div className="mt-3 rounded-2xl bg-blue-50 border border-blue-100 p-4 text-center">
              <p className="text-xs font-black text-slate-500">現在の勝率</p>
              <p className="text-4xl font-black text-blue-600 mt-1">
                {stats.winRate}%
              </p>
            </div>
          </section>
        )}

        {!loading && topAlert && (
          <section
            onClick={() => openAnalysis(topAlert, 0)}
            className="cursor-pointer rounded-[24px] bg-gradient-to-br from-white to-orange-50 border border-orange-200 p-4 mb-4 shadow-sm active:scale-[0.98] transition"
          >
            <div className="flex items-center justify-between">
              <p className="text-sm font-black text-orange-600">
                👑 本日の大本命
              </p>
              <span
                className={`rounded-xl border px-3 py-1 text-xs font-black ${getRankBadge(
                  getScore(topAlert)
                )}`}
              >
                {getAlertRank(getScore(topAlert))} {topAlert.score ?? 0}%
              </span>
            </div>

            <h2 className="text-3xl font-black mt-3">{topAlert.title}</h2>

            <div className="grid grid-cols-2 gap-3 mt-4">
              <Mini
                label="AI順位"
                value={`${topAlert.rank ?? "-"}位`}
                color="text-yellow-600"
              />
              <Mini
                label="勝率予測"
                value={`${topAlert.winRate ?? 0}%`}
                color="text-green-600"
              />
            </div>

            <div className="mt-3 rounded-2xl bg-white/80 border border-orange-100 p-3">
              <p className="text-xs font-black text-slate-500 mb-2">
                AIが注目した理由
              </p>
              <div className="space-y-1">
                {createAiReasons(topAlert).slice(0, 4).map((reason) => (
                  <p key={reason} className="text-sm font-bold">
                    ✅ {reason}
                  </p>
                ))}
              </div>
            </div>

            <p className="text-sm text-slate-500 font-bold mt-3">
              タップで詳細分析へ
            </p>
          </section>
        )}

        <section className="grid grid-cols-3 gap-2 mb-4">
          <FilterButton
            label="すべて"
            active={filter === "all"}
            onClick={() => setFilter("all")}
          />
          <FilterButton
            label="未読"
            active={filter === "unread"}
            onClick={() => setFilter("unread")}
          />
          <FilterButton
            label="お気に入り"
            active={filter === "favorite"}
            onClick={() => setFilter("favorite")}
          />
        </section>

        {loading && (
          <section className="rounded-[24px] bg-white border border-slate-200 p-5 shadow-sm">
            <p className="font-bold text-slate-500">AI通知を読み込み中...</p>
          </section>
        )}

        {!loading && filteredAlerts.length === 0 && (
          <section className="rounded-[24px] bg-white border border-slate-200 p-5 shadow-sm text-center">
            <p className="text-4xl mb-3">🔕</p>
            <h2 className="text-xl font-black">通知はありません</h2>
            <p className="text-sm text-slate-500 font-bold mt-2">
              条件に合う通知はまだありません。
            </p>
          </section>
        )}

        <section className="space-y-3">
          {filteredAlerts.map((alert, index) => {
            const originalIndex = alerts.indexOf(alert);
            const id = getAlertId(alert, originalIndex);
            const isRead = readIds.includes(id);
            const score = alert.score ?? 0;
            const reasons = createAiReasons(alert);

            return (
              <div
                key={id}
                onClick={() => openAnalysis(alert, originalIndex)}
                className={`cursor-pointer rounded-[24px] border p-4 shadow-sm active:scale-[0.98] transition ${
                  isRead
                    ? "bg-white border-slate-200 opacity-70"
                    : "bg-white border-blue-200"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      {!isRead && (
                        <span className="w-2.5 h-2.5 rounded-full bg-blue-600" />
                      )}
                      <p className="text-xs font-black text-slate-500">
                        {getTypeIcon(alert.type)} {alert.type}
                      </p>
                    </div>

                    <h2 className="text-2xl font-black mt-2">
                      {alert.title}
                    </h2>
                  </div>

                  <span
                    className={`shrink-0 rounded-xl border px-3 py-1 text-xs font-black ${getRankBadge(
                      score
                    )}`}
                  >
                    {getAlertRank(score)} {score}%
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 mt-4">
                  <Mini
                    label="現在値"
                    value={alert.priceText || "-"}
                    color="text-slate-900"
                  />
                  <Mini
                    label="必要資金"
                    value={alert.requiredCapitalText || "-"}
                    color="text-slate-900"
                  />
                  <Mini
                    label="利確"
                    value={alert.takeProfitText || "-"}
                    color="text-green-600"
                  />
                  <Mini
                    label="損切"
                    value={alert.stopLossText || "-"}
                    color="text-red-500"
                  />
                </div>

                <div className="mt-3 rounded-2xl bg-slate-50 border border-slate-100 p-3">
                  <p className="text-xs font-black text-slate-500 mb-2">
                    AI判断理由
                  </p>

                  <div className="space-y-1">
                    {reasons.map((reason) => (
                      <p key={reason} className="text-sm font-bold leading-6">
                        ✅ {reason}
                      </p>
                    ))}
                  </div>
                </div>

                <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200">
                  <div
                    className={`h-full ${
                      score >= 85
                        ? "bg-purple-500"
                        : score >= 70
                        ? "bg-green-500"
                        : score >= 50
                        ? "bg-blue-500"
                        : "bg-slate-400"
                    }`}
                    style={{ width: `${Math.max(5, Math.min(score, 100))}%` }}
                  />
                </div>

                <div className="mt-3 flex items-center justify-between text-xs font-bold text-slate-500">
                  <p>
                    AI順位 {alert.rank ?? "-"}位 / {alert.totalRank ?? "-"}銘柄
                  </p>
                  <p>{isRead ? "既読" : "未読"}</p>
                </div>
              </div>
            );
          })}
        </section>
      </div>

      <BottomNav />
    </main>
  );
}

function Mini({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: string;
}) {
  return (
    <div className="rounded-2xl bg-slate-50 border border-slate-100 p-3 text-center">
      <p className="text-[10px] font-black text-slate-500">{label}</p>
      <p className={`text-lg font-black mt-1 ${color}`}>{value}</p>
    </div>
  );
}

function FilterButton({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-2xl py-3 text-sm font-black ${
        active
          ? "bg-blue-600 text-white"
          : "bg-white text-slate-500 border border-slate-200"
      }`}
    >
      {label}
    </button>
  );
}

function BottomNav() {
  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200">
      <div className="mx-auto max-w-md grid grid-cols-5 py-2">
        <Nav href="/" icon="🏠" label="ホーム" />
        <Nav href="/today-market" icon="🤖" label="市場" />
        <Nav href="/favorites" icon="⭐" label="お気に入り" />
        <Nav href="/alerts" icon="🔔" label="通知" active />
        <Nav href="/learning" icon="🧠" label="学習" />
      </div>
    </nav>
  );
}

function Nav({
  href,
  icon,
  label,
  active,
}: {
  href: string;
  icon: string;
  label: string;
  active?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`text-center text-xs font-bold ${
        active ? "text-yellow-500" : "text-slate-500"
      }`}
    >
      <div className="text-2xl">{icon}</div>
      {label}
    </Link>
  );
}