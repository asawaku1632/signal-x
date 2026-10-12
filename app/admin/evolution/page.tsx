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
    <main className="min-h-screen bg-[#f7f9fc] pb-12 text-slate-900">
      <div className="mx-auto max-w-5xl px-3 py-3 sm:px-5 sm:py-5">
        <header className="mb-3 rounded-2xl border border-white bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between gap-2">
            <Link href="/" className="text-xs font-black text-blue-600">← SIGNALX Home</Link>
            <button onClick={load} className="rounded-xl bg-slate-950 px-3 py-2 text-xs font-black text-white hover:bg-blue-600">
              🔄 更新
            </button>
          </div>
          <h1 className="mt-2 text-xl font-black tracking-tight sm:text-2xl">🤖 AI成長センター</h1>
          <p className="mt-1 text-xs leading-5 text-slate-500">
            学習・勝率・改善状況を確認。最終記録：{formatDate(latest.createdAt)}
          </p>
        </header>

        <section className={"overflow-hidden rounded-2xl bg-gradient-to-br p-4 text-white shadow-sm sm:p-5 " + qualityColor(latest.qualityScore)}>
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-black tracking-widest text-white/80">AI QUALITY</p>
              <div className="mt-1 flex items-baseline gap-1.5">
                <span className="text-5xl font-black leading-none">{latest.qualityScore}</span>
                <span className="text-sm font-black text-white/75">/ 100</span>
              </div>
            </div>
            <p className="rounded-xl bg-white/20 px-3 py-2 text-sm font-black">{latest.qualityLabel}</p>
          </div>
          <p className="mt-2 text-xs leading-5 text-white/90">{latestMessage}</p>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <GlassMini label="総合的中率" value={latest.overallWinRate + "%"} />
            <GlassMini label="学習データ" value={formatNumber(latest.judgedRecords) + "件"} />
            <GlassMini label="勝ちパターン" value={formatNumber(latest.activeWeightRules) + "種類"} />
            <GlassMini label="改善候補" value={formatNumber(latest.changedCount) + "ヶ所"} />
          </div>
        </section>

        <div className="mt-3 grid grid-cols-2 gap-2">
          <div className="rounded-xl border border-slate-200 bg-white p-3">
            <p className="text-xs font-bold text-slate-500">判定済みパターン</p>
            <p className="mt-1 text-lg font-black">{formatNumber(latest.patternCount)}件</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-3">
            <p className="text-xs font-bold text-slate-500">自動学習</p>
            <p className="mt-1 text-base font-black">{cronLabel(latest.cronStatus)}</p>
          </div>
        </div>

        <details className="group mt-3 rounded-2xl border border-slate-200 bg-white shadow-sm">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-2 p-4">
            <span className="text-sm font-black">📈 AIの成長グラフ</span>
            <span className="text-xs font-bold text-blue-600">開閉 <span className="inline-block transition group-open:rotate-180">▼</span></span>
          </summary>
          <div className="border-t border-slate-100 p-3">
            <p className="mb-3 text-xs leading-5 text-slate-500">
              1日につき最新1件を表示。完成度・的中率・学習件数・改善候補数の推移を確認できます。
            </p>
            <Link href="/admin/evolution/report" className="mb-3 inline-block rounded-lg bg-blue-600 px-3 py-2 text-xs font-bold text-white">
              詳細レポートを見る →
            </Link>
            <EvolutionChart history={history} />
          </div>
        </details>

        <details className="group mt-3 rounded-2xl border border-slate-200 bg-white shadow-sm">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-2 p-4">
            <span className="text-sm font-black">📜 AI成長履歴（{history.length}日分）</span>
            <span className="text-xs font-bold text-blue-600">開閉 <span className="inline-block transition group-open:rotate-180">▼</span></span>
          </summary>
          <div className="space-y-2 border-t border-slate-100 p-3">
            <Link href="/admin/evolution/history" className="inline-block rounded-lg bg-slate-100 px-3 py-2 text-xs font-bold text-slate-700">
              履歴ページへ →
            </Link>
            {history.map((item) => (
              <div key={item.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="font-black">{formatDate(item.createdAt)}</span>
                  <span className={item.cronStatus === "SUCCESS" ? "font-bold text-emerald-700" : "font-bold text-red-600"}>
                    {cronLabel(item.cronStatus)}
                  </span>
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2 text-xs sm:grid-cols-3">
                  <HistoryItem label="AI完成度" value={item.qualityScore + "点"} />
                  <HistoryItem label="総合的中率" value={item.overallWinRate + "%"} />
                  <HistoryItem label="学習データ" value={formatNumber(item.judgedRecords) + "件"} />
                  <HistoryItem label="勝ちパターン" value={formatNumber(item.activeWeightRules) + "種類"} />
                  <HistoryItem label="改善候補" value={formatNumber(item.changedCount) + "ヶ所"} />
                  <HistoryItem label="判定済みパターン" value={formatNumber(item.patternCount) + "件"} />
                </div>
              </div>
            ))}
          </div>
        </details>
      </div>
    </main>
  );
}

function GlassMini({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="min-w-0 rounded-xl bg-white/15 p-2.5 text-center backdrop-blur">
      <p className="text-xs font-black text-white/70">{label}</p>
      <p className="mt-1 break-words text-base font-black">{value}</p>
    </div>
  );
}

function HistoryItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-white p-2">
      <div className="text-xs font-black text-slate-500">{label}</div>
      <div className="mt-0.5 text-sm font-black text-slate-900">{value}</div>
    </div>
  );
}
