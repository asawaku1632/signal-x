"use client";

import { useEffect, useState } from "react";

type Signal = {
  code: string;
  name: string;
  price: number;
  changePercent: number;
  volumeRatio: number;
  rsi: number;
  score: number;
  learningBonus?: number;
  reason?: string;
};

type Notice = {
  type: "hot" | "strong" | "watch" | "danger" | "learning";
  title: string;
  message: string;
  power: number;
  code?: string;
};

export default function AiCenterPage() {
  const [notices, setNotices] = useState<Notice[]>([]);
  const [loading, setLoading] = useState(true);

  const getNoticeStyle = (type: Notice["type"]) => {
    if (type === "hot") {
      return "border-purple-500 bg-purple-950/60 text-purple-100";
    }

    if (type === "strong") {
      return "border-orange-500 bg-orange-950/50 text-orange-100";
    }

    if (type === "watch") {
      return "border-cyan-500 bg-cyan-950/40 text-cyan-100";
    }

    if (type === "danger") {
      return "border-red-500 bg-red-950/50 text-red-100";
    }

    return "border-green-500 bg-green-950/40 text-green-100";
  };

  const getIcon = (type: Notice["type"]) => {
    if (type === "hot") return "🔥";
    if (type === "strong") return "⚡";
    if (type === "watch") return "👁";
    if (type === "danger") return "⚠";
    return "🧠";
  };

  const buildNotices = (signals: Signal[]) => {
    const newNotices: Notice[] = [];

    const sorted = [...signals].sort((a, b) => b.score - a.score);
    const top = sorted[0];

    if (top) {
      if (top.score >= 90) {
        newNotices.push({
          type: "hot",
          title: "ULTIMATE SIGNAL",
          message: `${top.name} が最重要候補。AI SCORE ${top.score}`,
          power: top.score,
          code: top.code,
        });
      } else if (top.score >= 70) {
        newNotices.push({
          type: "strong",
          title: "強シグナル検出",
          message: `${top.name} が強い。監視優先度高め`,
          power: top.score,
          code: top.code,
        });
      } else if (top.score >= 50) {
        newNotices.push({
          type: "watch",
          title: "監視継続",
          message: `${top.name} がやや優勢。まだ飛びつかない`,
          power: top.score,
          code: top.code,
        });
      }
    }

    const danger = sorted.find((item) => item.score < 50);

    if (danger) {
      newNotices.push({
        type: "danger",
        title: "触るな候補",
        message: `${danger.name} は弱い。今は無理に触らない`,
        power: danger.score,
        code: danger.code,
      });
    }

    const learningTarget = sorted.find(
      (item) => item.learningBonus && item.learningBonus > 0
    );

    if (learningTarget) {
      newNotices.push({
        type: "learning",
        title: "AI学習補正あり",
        message: `${learningTarget.name} に過去データ補正 +${learningTarget.learningBonus}`,
        power: learningTarget.learningBonus || 0,
        code: learningTarget.code,
      });
    }

    return newNotices.slice(0, 5);
  };

  const fetchNotices = async () => {
    try {
      const res = await fetch("/api/scan");
      const result = await res.json();

      const signals: Signal[] = result.stocks || [];
      const built = buildNotices(signals);

      setNotices(built);
    } catch (error) {
      console.error("AI通知取得失敗", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotices();

    const timer = setInterval(() => {
      fetchNotices();
    }, 5000);

    return () => clearInterval(timer);
  }, []);

  return (
    <main className="min-h-screen bg-black text-white p-4 max-w-md mx-auto">
      <h1 className="text-3xl font-black">AI通知センター</h1>

      <p className="text-xs text-gray-400 mt-1">
        SIGNALXが今見るべき情報をリアルタイム通知
      </p>

      {loading && (
        <p className="text-sm text-gray-500 mt-6">AI解析中...</p>
      )}

      {!loading && notices.length === 0 && (
        <p className="text-sm text-gray-500 mt-6">
          現在、重要通知はありません
        </p>
      )}

      <section className="mt-6 space-y-4">
        {notices.map((notice, index) => (
          <div
            key={`${notice.title}-${index}`}
            className={`rounded-3xl border p-5 shadow-2xl ${getNoticeStyle(
              notice.type
            )}`}
          >
            <div className="flex justify-between items-start gap-4">
              <div>
                <p className="text-3xl">{getIcon(notice.type)}</p>

                <h2 className="text-xl font-black mt-3">
                  {notice.title}
                </h2>

                <p className="text-sm mt-2 opacity-90">
                  {notice.message}
                </p>

                {notice.code && (
                  <p className="text-xs mt-3 opacity-60">
                    CODE：{notice.code}
                  </p>
                )}
              </div>

              <div className="text-right">
                <p className="text-[10px] opacity-60">POWER</p>

                <p className="text-5xl font-black">
                  {notice.power}
                </p>
              </div>
            </div>
          </div>
        ))}
      </section>

      <section className="mt-6 rounded-3xl border border-zinc-800 bg-zinc-900 p-4">
        <p className="text-xs text-gray-400">SYSTEM STATUS</p>

        <div className="mt-3 grid grid-cols-2 gap-3">
          <div className="rounded-2xl bg-black/40 p-3">
            <p className="text-[10px] text-gray-500">更新間隔</p>
            <p className="text-xl font-black text-cyan-400">5秒</p>
          </div>

          <div className="rounded-2xl bg-black/40 p-3">
            <p className="text-[10px] text-gray-500">AI状態</p>
            <p className="text-xl font-black text-green-400">ACTIVE</p>
          </div>
        </div>
      </section>
    </main>
  );
}