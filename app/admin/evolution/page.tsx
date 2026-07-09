"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import EvolutionChart from "@/components/Evolution/EvolutionChart";

type EvolutionSummary = {
  id: number;
  qualityScore: number;
  qualityLabel: string;
  judgedRecords: number;
  overallWinRate: number;
  patternCount: number;
  sectorCount: number;
  activeWeightRules: number;
  optimizedCount: number;
  changedCount: number;
  cronStatus: string;
  createdAt: string;
};

function formatNumber(value: number) {
  return new Intl.NumberFormat("ja-JP").format(value ?? 0);
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleString("ja-JP", {
    year: "numeric",
    month: "numeric",
    day: "numeric",
  });
}

function getDayKey(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function pickLatestPerDay(history: EvolutionSummary[]) {
  const map = new Map<string, EvolutionSummary>();

  for (const item of history) {
    const key = getDayKey(item.createdAt);
    const current = map.get(key);

    if (!current) {
      map.set(key, item);
      continue;
    }

    const currentTime = new Date(current.createdAt).getTime();
    const itemTime = new Date(item.createdAt).getTime();

    if (itemTime > currentTime) {
      map.set(key, item);
    }
  }

  return Array.from(map.values()).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

function qualityMessage(score: number, label: string) {
  if (score >= 95) {
    return "現在のAIは最高評価です。毎日の学習結果をもとに、判断力を高い水準で維持しています。";
  }

  if (score >= 85) {
    return "現在のAIはかなり良い状態です。学習データが増えるほど、さらに安定していきます。";
  }

  if (score >= 70) {
    return "現在のAIは標準以上の状態です。引き続き学習を重ねて精度を高めています。";
  }

  return `現在のAIは改善中です。評価：${label}`;
}

function cronLabel(status: string) {
  return status === "SUCCESS" ? "正常動作中" : "確認が必要";
}

function qualityColor(score: number) {
  if (score >= 95) return "from-yellow-400 to-orange-500";
  if (score >= 85) return "from-blue-500 to-emerald-500";
  if (score >= 70) return "from-blue-500 to-indigo-600";
  return "from-slate-500 to-slate-800";
}

export default function EvolutionPage() {
  const [latest, setLatest] = useState<EvolutionSummary | null>(null);
  const [history, setHistory] = useState<EvolutionSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    try {
      setLoading(true);

      const res = await fetch("/api/evolution/summary?limit=100", {
        cache: "no-store",
      });

      const json = await res.json();
      const rawHistory: EvolutionSummary[] = json.history ?? [];
      const dailyHistory = pickLatestPerDay(rawHistory);

      setLatest(dailyHistory[0] ?? json.latest ?? null);
      setHistory(dailyHistory);
    } catch (error) {
      console.error("evolution summary fetch error:", error);
    } finally {
      setLoading(false);
    }
  }

  const latestMessage = useMemo(() => {
    if (!latest) return "";
    return qualityMessage(latest.qualityScore, latest.qualityLabel);
  }, [latest]);

  if (loading) {
    return (
      <main className="min-h-screen bg-[#f7f9fc] p-5 text-slate-900">
        <div className="mx-auto max-w-5xl">
          <div className="rounded-[2rem] bg-white p-6 shadow-sm">
            <p className="text-2xl font-black">AI成長データを読み込み中...</p>
            <p className="mt-2 text-sm font-bold text-slate-500">
              SIGNALXの自己学習データを取得しています。
            </p>
          </div>
        </div>
      </main>
    );
  }

  if (!latest) {
    return (
      <main className="min-h-screen bg-[#f7f9fc] p-5 text-slate-900">
        <div className="mx-auto max-w-5xl">
          <Link href="/" className="text-sm font-black text-blue-600">
            ← Homeへ戻る
          </Link>

          <div className="mt-5 rounded-[2rem] bg-white p-6 shadow-sm">
            <h1 className="text-2xl font-black">AI成長データがまだありません。</h1>
            <p className="mt-2 text-sm font-bold text-slate-500">
              自動学習が記録されると、この画面にAIの成長履歴が表示されます。
            </p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f7f9fc] pb-24 text-slate-900">
      <div className="mx-auto max-w-7xl px-5 py-5 md:px-8 md:py-8">
        <header className="mb-6 flex flex-col gap-4 rounded-[2.5rem] border border-white bg-white/80 p-5 shadow-sm backdrop-blur-xl md:flex-row md:items-center md:justify-between">
          <div>
            <Link href="/" className="inline-flex items-center gap-2 text-sm font-black text-blue-600">
              ← SIGNALX Home
            </Link>

            <div className="mt-4 inline-flex rounded-full bg-blue-50 px-4 py-2 text-xs font-black tracking-[0.18em] text-blue-700">
              AI EVOLUTION CENTER
            </div>

            <h1 className="mt-4 text-4xl font-black tracking-tight md:text-5xl">
              🤖 SIGNALX AI成長センター
            </h1>

            <p className="mt-4 max-w-3xl text-sm font-medium leading-8 text-slate-600 md:text-base">
              SIGNALXのAIが、どれくらい学習し、どれくらい成長しているかを確認する画面です。
              毎営業日の学習結果をもとに、AIの完成度・的中率・改善状況を見える化しています。
            </p>
          </div>

          <button
            onClick={load}
            className="w-fit rounded-full bg-slate-950 px-6 py-4 text-sm font-black text-white shadow-lg shadow-slate-200 transition hover:bg-blue-600 active:scale-95"
          >
            🔄 再読み込み
          </button>
        </header>

        <section className={`overflow-hidden rounded-[2.5rem] bg-gradient-to-br ${qualityColor(latest.qualityScore)} p-6 text-white shadow-2xl shadow-blue-200 md:p-8`}>
          <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-xs font-black tracking-[0.18em] text-white/75">
                CURRENT AI QUALITY
              </p>

              <div className="mt-4 flex items-end gap-3">
                <p className="text-7xl font-black leading-none md:text-8xl">
                  {latest.qualityScore}
                </p>
                <p className="pb-2 text-2xl font-black text-white/70">/ 100</p>
              </div>

              <p className="mt-3 text-2xl font-black">{latest.qualityLabel}</p>
            </div>

            <div className="max-w-xl rounded-[2rem] bg-white/15 p-5 backdrop-blur">
              <p className="text-sm font-bold leading-8 text-white/90">{latestMessage}</p>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
            <GlassMini label="的中率" value={`${latest.overallWinRate}%`} />
            <GlassMini label="学習件数" value={`${formatNumber(latest.judgedRecords)}件`} />
            <GlassMini label="改善数" value={`${formatNumber(latest.changedCount)}ヶ所`} />
            <GlassMini label="自動学習" value={cronLabel(latest.cronStatus)} />
          </div>
        </section>

        <section className="mt-6 rounded-[2rem] border border-amber-200 bg-amber-50 p-5 shadow-sm">
          <p className="text-sm font-bold leading-7 text-amber-900">
            グラフと履歴は、同じ日のデータをまとめて「その日の最新1件」だけ表示しています。
            そのため、AIの成長を日ごとに確認できます。
          </p>
        </section>

        <div className="mt-6 grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
          <MetricCard
            icon="🎯"
            title="予測的中率"
            value={`${latest.overallWinRate}%`}
            description={`勝敗が確定したデータでは、100回中およそ${Math.round(latest.overallWinRate)}回の精度です。`}
            tone="blue"
          />

          <MetricCard
            icon="📚"
            title="学習済みデータ"
            value={`${formatNumber(latest.judgedRecords)}件`}
            description="AIが実際の株価結果を見て学習した件数です。"
            tone="slate"
          />

          <MetricCard
            icon="🧩"
            title="AIが覚えた勝ちパターン"
            value={`${formatNumber(latest.activeWeightRules)}種類`}
            description="AIが「この形は強い・弱い」と覚えた判断パターン数です。"
            tone="emerald"
          />

          <MetricCard
            icon="🔄"
            title="今日改善した数"
            value={`${formatNumber(latest.changedCount)}ヶ所`}
            description="AIが学習結果をもとに、判断基準を見直した数です。"
            tone="purple"
          />

          <MetricCard
            icon="📈"
            title="判定済みパターン"
            value={`${formatNumber(latest.patternCount)}件`}
            description="AIがチャート形状ごとに結果を確認した件数です。"
            tone="blue"
          />

          <MetricCard
            icon="🤖"
            title="自動学習"
            value={cronLabel(latest.cronStatus)}
            description="毎営業日15:40頃に、AIが自動で学習・評価・記録します。"
            good={latest.cronStatus === "SUCCESS"}
            tone="emerald"
          />
        </div>

        <section className="mt-6 rounded-[2.5rem] border border-white bg-white p-5 shadow-sm md:p-6">
          <div className="mb-5 flex flex-col justify-between gap-3 md:flex-row md:items-end">
            <div>
              <p className="text-xs font-black tracking-[0.18em] text-blue-600">
                AI GROWTH CHART
              </p>
              <h2 className="mt-2 text-3xl font-black">📈 AIの成長グラフ</h2>
              <p className="mt-2 text-sm font-medium leading-7 text-slate-600">
                AI完成度・的中率・学習件数・改善数の推移を日ごとに確認できます。
              </p>
            </div>

            <Link
              href="/admin/evolution/report"
              className="w-fit rounded-full bg-blue-600 px-5 py-3 text-sm font-black text-white shadow-lg shadow-blue-100 transition hover:bg-blue-700"
            >
              レポートを見る
            </Link>
          </div>

          <div className="overflow-hidden rounded-[2rem] bg-slate-50 p-3">
            <EvolutionChart history={history} />
          </div>
        </section>

        <section className="mt-6">
          <div className="mb-4 flex flex-col justify-between gap-3 md:flex-row md:items-end">
            <div>
              <p className="text-xs font-black tracking-[0.18em] text-blue-600">
                AI HISTORY
              </p>
              <h2 className="mt-2 text-3xl font-black">📜 AI成長履歴</h2>
            </div>

            <Link
              href="/admin/evolution/history"
              className="w-fit rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-black text-slate-700 shadow-sm transition hover:text-blue-600"
            >
              履歴ページへ
            </Link>
          </div>

          <div className="space-y-4">
            {history.map((item) => (
              <div
                key={item.id}
                className="rounded-[2rem] border border-white bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg"
              >
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="text-xs font-black tracking-[0.18em] text-slate-400">
                      LEARNING DATE
                    </p>
                    <p className="mt-1 text-xl font-black">{formatDate(item.createdAt)}</p>
                  </div>

                  <div
                    className={`w-fit rounded-full px-4 py-2 text-sm font-black ${
                      item.cronStatus === "SUCCESS"
                        ? "bg-emerald-50 text-emerald-700"
                        : "bg-red-50 text-red-700"
                    }`}
                  >
                    自動学習：{cronLabel(item.cronStatus)}
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3 text-sm text-slate-700 md:grid-cols-3">
                  <HistoryItem label="AI完成度" value={`${item.qualityScore}点`} />
                  <HistoryItem label="予測的中率" value={`${item.overallWinRate}%`} />
                  <HistoryItem label="学習済みデータ" value={`${formatNumber(item.judgedRecords)}件`} />
                  <HistoryItem label="勝ちパターン" value={`${formatNumber(item.activeWeightRules)}種類`} />
                  <HistoryItem label="改善した数" value={`${formatNumber(item.changedCount)}ヶ所`} />
                  <HistoryItem label="判定済みパターン" value={`${formatNumber(item.patternCount)}件`} />
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}

function MetricCard({
  icon,
  title,
  value,
  description,
  good,
  tone = "slate",
}: {
  icon: string;
  title: string;
  value: string | number;
  description: string;
  good?: boolean;
  tone?: "blue" | "emerald" | "purple" | "slate";
}) {
  const toneClass = {
    blue: "bg-blue-50 text-blue-600",
    emerald: "bg-emerald-50 text-emerald-600",
    purple: "bg-purple-50 text-purple-600",
    slate: "bg-slate-50 text-slate-900",
  }[tone];

  return (
    <div className="rounded-[2rem] border border-white bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-xl">
      <div className="flex items-center gap-3">
        <div className="grid h-14 w-14 place-items-center rounded-2xl bg-slate-50 text-3xl">
          {icon}
        </div>
        <div className="text-sm font-black text-slate-500">{title}</div>
      </div>

      <div className={`mt-5 rounded-3xl px-4 py-4 text-3xl font-black ${good ? "bg-emerald-50 text-emerald-600" : toneClass}`}>
        {value}
      </div>

      <p className="mt-4 text-sm font-medium leading-7 text-slate-600">{description}</p>
    </div>
  );
}

function GlassMini({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-3xl bg-white/15 p-4 text-center backdrop-blur">
      <p className="text-xs font-black text-white/70">{label}</p>
      <p className="mt-2 text-xl font-black">{value}</p>
    </div>
  );
}

function HistoryItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-slate-50 p-4">
      <div className="text-xs font-black text-slate-500">{label}</div>
      <div className="mt-1 text-lg font-black text-slate-900">{value}</div>
    </div>
  );
}
