"use client";

import { useEffect, useState } from "react";

type EvolutionReport = {
  date: string;
  learningCount: number;
  winCount: number;
  loseCount: number;
  holdCount: number;
  aiCompletion: number;
  accuracy: number;
  winPatternCount: number;
  improvementCount: number;
  aiComment: string;
};

export default function EvolutionReportHistoryPage() {
  const [reports, setReports] = useState<EvolutionReport[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadReports() {
      try {
        const res = await fetch("/api/evolution/report/history", {
          cache: "no-store",
        });

        const data = await res.json();

        if (data.success && Array.isArray(data.reports)) {
          setReports(data.reports);
        }
      } catch (error) {
        console.error("AI成長レポート履歴の取得に失敗しました", error);
      } finally {
        setLoading(false);
      }
    }

    loadReports();
  }, []);

  return (
    <main className="min-h-screen bg-[#f7f9fc] px-5 py-8 text-slate-900">
      <div className="mx-auto max-w-5xl">
        <p className="text-sm font-bold text-blue-600">
          SIGNALX AI HISTORY
        </p>

        <h1 className="mt-2 text-3xl font-black">
          AI成長レポート履歴
        </h1>

        <p className="mt-3 text-sm font-bold text-slate-500">
          SIGNALXのAIが、日々どのように学習し成長してきたかを一覧で確認できます。
        </p>

        {loading && (
          <div className="mt-8 rounded-3xl border border-slate-200 bg-white p-6 text-center shadow-sm">
            <p className="text-sm font-bold text-slate-500">
              AI成長レポートを読み込み中...
            </p>
          </div>
        )}

        {!loading && reports.length === 0 && (
          <div className="mt-8 rounded-3xl border border-slate-200 bg-white p-6 text-center shadow-sm">
            <p className="text-lg font-black text-slate-800">
              まだAI成長レポート履歴がありません
            </p>
            <p className="mt-2 text-sm font-bold text-slate-500">
              学習が実行されると、ここに毎日のAI成長記録が表示されます。
            </p>
          </div>
        )}

        <div className="mt-8 space-y-5">
          {reports.map((report) => (
            <section
              key={report.date}
              className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm"
            >
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-black text-blue-600">
                    {report.date}
                  </p>
                  <h2 className="mt-1 text-xl font-black">
                    今日のAI成長レポート
                  </h2>
                </div>

                <div className="rounded-full bg-blue-50 px-4 py-2 text-sm font-black text-blue-700">
                  AI完成度 {report.aiCompletion}%
                </div>
              </div>

              <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <StatCard label="学習件数" value={`${report.learningCount}件`} />
                <StatCard label="WIN" value={`${report.winCount}件`} />
                <StatCard label="LOSE" value={`${report.loseCount}件`} />
                <StatCard label="HOLD" value={`${report.holdCount}件`} />
                <StatCard label="的中率" value={`${report.accuracy}%`} />
                <StatCard label="勝ちパターン" value={`${report.winPatternCount}件`} />
                <StatCard label="改善数" value={`${report.improvementCount}件`} />
                <StatCard label="AI完成度" value={`${report.aiCompletion}%`} />
              </div>

              <div className="mt-5 rounded-3xl bg-slate-50 p-5">
                <p className="text-sm font-black text-slate-500">
                  AIコメント
                </p>
                <p className="mt-2 text-sm font-bold leading-7 text-slate-700">
                  {report.aiComment || "AIコメントはまだ生成されていません。"}
                </p>
              </div>
            </section>
          ))}
        </div>
      </div>
    </main>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-3xl bg-slate-50 p-4">
      <p className="text-xs font-black text-slate-500">{label}</p>
      <p className="mt-2 text-xl font-black text-slate-900">{value}</p>
    </div>
  );
}