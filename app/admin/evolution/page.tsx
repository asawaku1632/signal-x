"use client";

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
  return new Intl.NumberFormat("ja-JP").format(value);
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

export default function EvolutionPage() {
  const [latest, setLatest] = useState<EvolutionSummary | null>(null);
  const [history, setHistory] = useState<EvolutionSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    try {
      const res = await fetch("/api/evolution/summary?limit=100", {
        cache: "no-store",
      });

      const json = await res.json();
      const rawHistory = json.history ?? [];
      const dailyHistory = pickLatestPerDay(rawHistory);

      setLatest(dailyHistory[0] ?? json.latest);
      setHistory(dailyHistory);
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
      <main className="min-h-screen bg-gray-50 p-8">
        <div className="text-xl font-bold">AI成長データを読み込み中...</div>
      </main>
    );
  }

  if (!latest) {
    return (
      <main className="min-h-screen bg-gray-50 p-8">
        <div className="text-xl font-bold">AI成長データがまだありません。</div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 p-6 md:p-8">
      <div className="mx-auto max-w-7xl space-y-8">
        <header className="space-y-3">
          <div className="inline-flex rounded-full bg-blue-50 px-4 py-2 text-sm font-bold text-blue-700">
            SIGNALX 自己学習AI
          </div>

          <h1 className="text-3xl font-bold md:text-4xl">
            🤖 SIGNALX AI成長センター
          </h1>

          <p className="max-w-3xl text-gray-600">
            SIGNALXのAIが、どれくらい学習し、どれくらい成長しているかを確認する画面です。
            毎営業日の学習結果をもとに、AIの完成度・的中率・改善状況を見える化しています。
          </p>

          <div className="rounded-2xl bg-amber-50 p-4 text-sm text-amber-900">
            グラフと履歴は、同じ日のデータをまとめて「その日の最新1件」だけ表示しています。
            そのため、AIの成長を日ごとに確認できます。
          </div>
        </header>

        <section className="rounded-3xl border bg-white p-6 shadow">
          <div className="text-sm font-bold text-gray-500">AIの現在の実力</div>

          <div className="mt-3 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <div className="text-5xl font-black">
                {latest.qualityScore}
                <span className="ml-2 text-2xl text-gray-400">/ 100点</span>
              </div>

              <div className="mt-2 text-lg font-bold text-blue-600">
                {latest.qualityLabel}
              </div>
            </div>

            <div className="max-w-xl rounded-2xl bg-blue-50 p-4 text-blue-900">
              {latestMessage}
            </div>
          </div>
        </section>

        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
          <Card
            icon="🎯"
            title="予測的中率"
            value={`${latest.overallWinRate}%`}
            description={`勝敗が確定したデータでは、100回中およそ${Math.round(
              latest.overallWinRate
            )}回の精度です。`}
          />

          <Card
            icon="📚"
            title="学習済みデータ"
            value={`${formatNumber(latest.judgedRecords)}件`}
            description="AIが実際の株価結果を見て学習した件数です。"
          />

          <Card
            icon="🧩"
            title="AIが覚えた勝ちパターン"
            value={`${formatNumber(latest.activeWeightRules)}種類`}
            description="AIが「この形は強い・弱い」と覚えた判断パターン数です。"
          />

          <Card
            icon="🔄"
            title="今日改善した数"
            value={`${formatNumber(latest.changedCount)}ヶ所`}
            description="AIが学習結果をもとに、判断基準を見直した数です。"
          />

          <Card
            icon="📈"
            title="判定済みパターン"
            value={`${formatNumber(latest.patternCount)}件`}
            description="AIがチャート形状ごとに結果を確認した件数です。"
          />

          <Card
            icon="🤖"
            title="自動学習"
            value={cronLabel(latest.cronStatus)}
            description="毎営業日15:40頃に、AIが自動で学習・評価・記録します。"
            good={latest.cronStatus === "SUCCESS"}
          />
        </div>

        <section className="rounded-3xl border bg-white p-5 shadow">
          <div className="mb-4">
            <h2 className="text-2xl font-bold">📈 AIの成長グラフ</h2>
            <p className="mt-1 text-gray-600">
              AI完成度・的中率・学習件数・改善数の推移を日ごとに確認できます。
            </p>
          </div>

          <EvolutionChart history={history} />
        </section>

        <section>
          <h2 className="mb-4 text-2xl font-bold">📜 AI成長履歴</h2>

          <div className="space-y-3">
            {history.map((item) => (
              <div
                key={item.id}
                className="rounded-2xl border bg-white p-5 shadow"
              >
                <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                  <div className="font-bold">{formatDate(item.createdAt)}</div>

                  <div
                    className={`rounded-full px-3 py-1 text-sm font-bold ${
                      item.cronStatus === "SUCCESS"
                        ? "bg-green-50 text-green-700"
                        : "bg-red-50 text-red-700"
                    }`}
                  >
                    自動学習：{cronLabel(item.cronStatus)}
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-1 gap-3 text-sm text-gray-700 md:grid-cols-3">
                  <HistoryItem label="AI完成度" value={`${item.qualityScore}点`} />
                  <HistoryItem label="予測的中率" value={`${item.overallWinRate}%`} />
                  <HistoryItem
                    label="学習済みデータ"
                    value={`${formatNumber(item.judgedRecords)}件`}
                  />
                  <HistoryItem
                    label="勝ちパターン"
                    value={`${formatNumber(item.activeWeightRules)}種類`}
                  />
                  <HistoryItem
                    label="改善した数"
                    value={`${formatNumber(item.changedCount)}ヶ所`}
                  />
                  <HistoryItem
                    label="判定済みパターン"
                    value={`${formatNumber(item.patternCount)}件`}
                  />
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}

function Card({
  icon,
  title,
  value,
  description,
  good,
}: {
  icon: string;
  title: string;
  value: string | number;
  description: string;
  good?: boolean;
}) {
  return (
    <div className="rounded-3xl border bg-white p-5 shadow">
      <div className="flex items-center gap-3">
        <div className="text-3xl">{icon}</div>
        <div className="text-sm font-bold text-gray-500">{title}</div>
      </div>

      <div
        className={`mt-4 text-3xl font-black ${
          good ? "text-green-600" : "text-gray-900"
        }`}
      >
        {value}
      </div>

      <p className="mt-3 text-sm leading-6 text-gray-600">{description}</p>
    </div>
  );
}

function HistoryItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-gray-50 p-3">
      <div className="text-xs font-bold text-gray-500">{label}</div>
      <div className="mt-1 text-lg font-bold text-gray-900">{value}</div>
    </div>
  );
}
