"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Audit = {
  success: true;
  asOf: string;
  reported: { wins: number; losses: number; winRate: number | null };
  historicalUntraced: { tradeDate: string; count: number; wins: number; losses: number; status: string };
  sensitivity: { excludingHistoricalUntraced: number | null; note: string };
  batches: Array<{ group_key: string; total: number; win: number; lose: number; hold: number }>;
  newProvenance: { count: number; latestAt: string | null; scope: string };
};

export default function AiWinRateAuditPage() {
  const [audit, setAudit] = useState<Audit | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    fetch("/api/admin/ai-win-rate-audit", { cache: "no-store" })
      .then(async (r) => {
        const result = await r.json();
        if (!r.ok) throw new Error(r.status === 403 ? "管理者としてログインしてください" : result.error ?? "取得失敗");
        setAudit(result);
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : "取得失敗"));
  }, []);

  return (
    <main className="min-h-screen bg-slate-50 px-3 py-3 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <div className="mx-auto max-w-3xl">
        <Link href="/admin/learning-status" className="text-xs font-bold text-blue-600">← AI学習管理へ</Link>
        <h1 className="mt-2 text-xl font-black sm:text-2xl">AI勝率の信頼性監査</h1>
        <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-300">
          管理者専用・読み取りのみ。過去データと現在の集計を分けて確認します。
        </p>
        {error && <p className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        {!audit && !error && <p className="mt-3 text-sm">監査データを読み込み中…</p>}
        {audit && (
          <>
            <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
              集計時点：{new Date(audit.asOf).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" })}
            </p>
            <section className="mt-2 grid grid-cols-2 gap-2">
              <Metric label="累計勝率" value={audit.reported.winRate === null ? "--" : audit.reported.winRate + "%"} />
              <Metric label="未追跡群除外（参考）" value={audit.sensitivity.excludingHistoricalUntraced === null ? "--" : audit.sensitivity.excludingHistoricalUntraced + "%"} />
              <Metric label={"過去の未追跡（" + audit.historicalUntraced.tradeDate.slice(5).replace("-", "/") + "）"} value={audit.historicalUntraced.count + "件"} />
              <Metric label="新しい株価追跡記録" value={audit.newProvenance.count + "件"} />
            </section>
            <p className="mt-2 text-xs leading-5 text-amber-700 dark:text-amber-300">{audit.sensitivity.note}</p>
            <details className="group mt-3 rounded-2xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-2 p-3">
                <span className="text-sm font-black">📋 過去データの監査（{audit.historicalUntraced.tradeDate}）</span>
                <span className="text-xs text-blue-600">詳細 <span className="inline-block transition group-open:rotate-180">▼</span></span>
              </summary>
              <div className="border-t border-slate-100 p-3 dark:border-slate-700">
                <p className="text-xs leading-5 text-slate-600 dark:text-slate-300">
                  この日付は過去の特別な監査対象日で、最新の学習日ではありません。
                  当時の保存株価と一致した20件とは別に、価格取得元を記録していなかったデータがあります。
                  取得元不明を誤判定とみなすことはできません。
                </p>
                <div className="mt-3 space-y-2">
                  {audit.batches.map((batch) => (
                    <div key={batch.group_key} className="rounded-lg bg-slate-100 p-3 text-xs dark:bg-slate-800">
                      <p className="font-black">
                        {batch.group_key === "snapshot_match_batch" ? "保存株価と一致した群" : batch.group_key === "untraced_legacy_batch" ? "取得元が未追跡の群" : "その他"}
                      </p>
                      <p className="mt-1">{batch.total}件 ｜ {batch.win}勝 {batch.lose}敗 {batch.hold}HOLD</p>
                    </div>
                  ))}
                </div>
              </div>
            </details>
            <p className="mt-3 text-xs leading-5 text-slate-500 dark:text-slate-400">
              新規の追跡記録は別保存し、過去の結果を後から「証明済み」には変更しません。
              追跡0件の場合は保存状況の確認が必要です。
            </p>
          </>
        )}
      </div>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
      <p className="text-xs font-bold text-slate-500 dark:text-slate-300">{label}</p>
      <p className="mt-1 break-words text-xl font-black sm:text-2xl">{value}</p>
    </div>
  );
}
