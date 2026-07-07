"use client";

import { useEffect, useMemo, useState } from "react";

type AiDailyReport = {
  date: string;
  qualityScore: number;
  qualityLabel: string;
  overallWinRate: number;
  judgedRecords: number;
  patternCount: number;
  activeWeightRules: number;
  changedWeight: number;
  cronStatus: string;
  processedCount: number;
  winCount: number;
  loseCount: number;
  holdCount: number;
  comment: string;
};

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleDateString("ja-JP", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "short",
  });
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("ja-JP").format(value);
}

function cronLabel(status: string) {
  return status === "SUCCESS" ? "正常動作中" : "確認が必要";
}

function splitComment(comment: string) {
  return comment
    .split("。")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => `${line}。`);
}

export default function AiDailyReportPage() {
  const [report, setReport] = useState<AiDailyReport | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadReport();
  }, []);

  async function loadReport() {
    try {
      const res = await fetch("/api/evolution/report", {
        cache: "no-store",
      });

      const json = await res.json();
      setReport(json.report ?? null);
    } finally {
      setLoading(false);
    }
  }

  const commentLines = useMemo(() => {
    if (!report?.comment) return [];
    return splitComment(report.comment);
  }, [report]);

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-50 p-8">
        <div className="text-xl font-bold">AI成長レポートを作成中...</div>
      </main>
    );
  }

  if (!report) {
    return (
      <main className="min-h-screen bg-gray-50 p-8">
        <div className="text-xl font-bold">AI成長レポートがまだありません。</div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 p-6 md:p-8">
      <div className="mx-auto max-w-5xl space-y-8">
        <header className="space-y-3">
          <div className="inline-flex rounded-full bg-blue-50 px-4 py-2 text-sm font-bold text-blue-700">
            SIGNALX AI REPORT
          </div>

          <h1 className="text-3xl font-black md:text-4xl">
            🤖 今日のAI成長レポート
          </h1>

          <p className="text-gray-600">
            SIGNALXのAIが、今日どれだけ学習し、何を改善したかを分かりやすくまとめています。
          </p>
        </header>

        <section className="rounded-3xl border bg-white p-6 shadow">
          <div className="text-sm font-bold text-gray-500">レポート日</div>
          <div className="mt-2 text-3xl font-black">{formatDate(report.date)}</div>

          <div className="mt-4 rounded-2xl bg-blue-50 p-4 text-blue-900">
            AIは本日の学習結果をもとに、判断基準と予測精度を確認しました。
          </div>
        </section>

        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
          <ReportCard icon="📚" title="本日の学習件数" value={`${formatNumber(report.processedCount)}件`} description="今日AIが確認した新しい学習データです。" />
          <ReportCard icon="🏆" title="WIN判定" value={`${formatNumber(report.winCount)}件`} description="AIが勝ちパターンとして学習した件数です。" />
          <ReportCard icon="📉" title="LOSE判定" value={`${formatNumber(report.loseCount)}件`} description="AIが負けパターンとして学習した件数です。" />
          <ReportCard icon="➖" title="HOLD判定" value={`${formatNumber(report.holdCount)}件`} description="まだ勝敗を急がず、様子見として記録した件数です。" />
          <ReportCard icon="🧠" title="AIが改善した判断基準" value={`${formatNumber(report.changedWeight)}ヶ所`} description="学習結果をもとにAIが見直した判断ポイントです。" />
          <ReportCard icon="⭐" title="AI完成度" value={`${report.qualityScore}点`} description={`${report.qualityLabel} 評価です。`} />
          <ReportCard icon="🎯" title="予測的中率" value={`${report.overallWinRate}%`} description="勝敗が確定したデータをもとにした現在の的中率です。" />
          <ReportCard icon="🧩" title="覚えた勝ちパターン" value={`${formatNumber(report.activeWeightRules)}種類`} description="AIが判断に使っている学習済みパターン数です。" />
          <ReportCard icon="🤖" title="自動学習" value={cronLabel(report.cronStatus)} description="毎営業日の自動学習が動いているかを示します。" good={report.cronStatus === "SUCCESS"} />
        </div>

        <section className="rounded-3xl border bg-white p-6 shadow">
          <div className="flex items-center gap-3">
            <div className="text-3xl">💬</div>
            <div>
              <h2 className="text-2xl font-bold">AIからのコメント</h2>
              <p className="text-sm text-gray-500">
                今日の学習結果に合わせて、AIが自動でコメントを作成しています。
              </p>
            </div>
          </div>

          <div className="mt-5 space-y-3">
            {commentLines.map((line, index) => (
              <p key={`${line}-${index}`} className="rounded-2xl bg-gray-50 p-4 leading-8 text-gray-800">
                {line}
              </p>
            ))}
          </div>
        </section>

        <section className="rounded-3xl border bg-white p-6 shadow">
          <h2 className="text-2xl font-bold">今日のまとめ</h2>

          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
            <SummaryItem label="今日AIが学んだこと" value={`${formatNumber(report.processedCount)}件の結果を確認`} />
            <SummaryItem label="判断基準の改善" value={`${formatNumber(report.changedWeight)}ヶ所を見直し`} />
            <SummaryItem label="現在の学習量" value={`${formatNumber(report.judgedRecords)}件を学習済み`} />
            <SummaryItem label="現在のAI状態" value={`${report.qualityScore}点 / ${report.qualityLabel}`} />
          </div>
        </section>
      </div>
    </main>
  );
}

function ReportCard({
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

      <div className={`mt-4 text-3xl font-black ${good ? "text-green-600" : "text-gray-900"}`}>
        {value}
      </div>

      <p className="mt-3 text-sm leading-6 text-gray-600">{description}</p>
    </div>
  );
}

function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-gray-50 p-4">
      <div className="text-sm font-bold text-gray-500">{label}</div>
      <div className="mt-1 text-xl font-black text-gray-900">{value}</div>
    </div>
  );
}
