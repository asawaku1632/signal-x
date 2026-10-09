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
    <main className="min-h-screen bg-slate-50 px-4 py-6 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <div className="mx-auto max-w-3xl">
        <Link href="/admin/learning-status" className="font-bold text-blue-600">← AI学習管理へ</Link>
        <h1 className="mt-4 text-3xl font-black">AI勝率の信頼性監査</h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">勝率の根拠を確認する管理者専用の読み取り画面です。判定は変更しません。</p>
        {error && <p className="mt-6 rounded-2xl bg-red-50 p-4 text-red-700">{error}</p>}
        {!audit && !error && <p className="mt-6">監査データを読み込み中…</p>}
        {audit && (
          <>
            <section className="mt-6 grid grid-cols-2 gap-3">
              <Metric label="現在の累計勝率" value={audit.reported.winRate === null ? "--" : `${audit.reported.winRate}%`} />
              <Metric label="未追跡群除外時（参考）" value={audit.sensitivity.excludingHistoricalUntraced === null ? "--" : `${audit.sensitivity.excludingHistoricalUntraced}%`} />
              <Metric label="取得元未記録（8/12）" value={`${audit.historicalUntraced.count}件`} />
              <Metric label="今後の個別株価追跡" value={`${audit.newProvenance.count}件`} />
            </section>
            <p className="mt-3 text-xs font-bold text-amber-700 dark:text-amber-300">{audit.sensitivity.note}</p>
            <section className="mt-6 rounded-2xl border bg-white p-5 dark:border-slate-700 dark:bg-slate-900">
              <h2 className="text-xl font-black">2026年8月12日の監査</h2>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                保存された8月13日の20件は価格一致を別途確認済み。20:28頃に判定された900件は個別の価格取得元が当時記録されていないため、正誤を断定しません。
              </p>
              <div className="mt-4 space-y-2">
                {audit.batches.map((batch) => (
                  <div key={batch.group_key} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-slate-100 p-3 text-sm dark:bg-slate-800">
                    <span className="font-bold">{batch.group_key === "snapshot_match_batch" ? "保存株価と一致する20件" : batch.group_key === "untraced_legacy_batch" ? "取得元未追跡の900件" : "その他"}</span>
                    <span>{batch.total}件｜{batch.win}勝 {batch.lose}敗 {batch.hold}HOLD</span>
                  </div>
                ))}
              </div>
            </section>
            <p className="mt-5 text-xs text-slate-500 dark:text-slate-400">
              今後の判定は比較元銘柄、株価、取引日、保存時刻を別途記録します。古い結果を遡って「証明済み」にすることはありません。
            </p>
          </>
        )}
      </div>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
      <p className="text-xs font-bold text-slate-500 dark:text-slate-300">{label}</p>
      <p className="mt-2 break-words text-2xl font-black">{value}</p>
    </div>
  );
}
