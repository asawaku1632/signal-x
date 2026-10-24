"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type ResearchStatus = {
  success: true;
  asOf: string;
  mode: string;
  source: string;
  providerRightsVerified: boolean;
  scheduledCaptureConfigured: boolean;
  databasePersistenceConfigured: boolean;
  lastObservation: null | { observedAt: string | null; capturedAt: string; ageMinutes: number | null; status: string };
  history: Array<{ date: string; observedAt: string | null; status: string; ageMinutes: number | null }>;
  note: string;
};

export default function MarketIndexResearchPage() {
  const [data, setData] = useState<ResearchStatus | null>(null);
  const [error, setError] = useState("");
  const [testRunning, setTestRunning] = useState(false);
  const [testResult, setTestResult] = useState<Record<string, unknown> | null>(null);
  const runCommitTest = async () => {
    if (testRunning || !window.confirm("開発用DBにテストデータを一時保存し、削除します。削除に失敗するとデータが残る可能性があります。実行しますか？")) return;
    setTestRunning(true);
    setTestResult(null);
    try {
      const response = await fetch("/api/admin/market-index-research/commit-retry-test", {
        method: "POST", credentials: "same-origin", cache: "no-store",
        headers: { "Content-Type": "application/json" }, body: "{}",
      });
      setTestResult(await response.json());
    } catch {
      setTestResult({ success: false, reason: "NETWORK_ERROR_OR_TIMEOUT", cleanupVerified: false });
    } finally {
      setTestRunning(false);
    }
  };
  useEffect(() => {
    fetch("/api/admin/market-index-research", { cache: "no-store" })
      .then(async r => {
        const json = await r.json();
        if (!r.ok) throw new Error(json.error || "取得失敗");
        setData(json);
      })
      .catch(e => setError(e instanceof Error ? e.message : "取得失敗"));
  }, []);
  const format = (iso: string) => new Date(iso).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" });
  return (
    <main className="min-h-screen bg-slate-50 px-3 py-5 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <div className="mx-auto max-w-3xl space-y-4">
        <Link href="/admin/learning-status" className="text-xs font-bold text-blue-600">← AI学習管理へ</Link>
        <div>
          <p className="text-xs font-bold text-slate-500">OWNER PRIVATE / RESEARCH SHADOW ONLY</p>
          <h1 className="mt-1 text-2xl font-black">📊 日経平均・データ取得検証</h1>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">STEP 27｜市場データの鮮度・取得履歴を確認するための管理者専用画面</p>
        </div>
        {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        {!data && !error && <p className="text-sm">研究状態を確認中…</p>}
        {data && <>
          <section className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-amber-950 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-100">
            <h2 className="font-black">⚠ 自動保存は未接続</h2>
            <p className="mt-2 text-sm leading-6">{data.note}</p>
          </section>
          <div className="grid grid-cols-2 gap-3">
            <section className="rounded-2xl border bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
              <p className="text-xs text-slate-500">最新チェック</p>
              <p className="mt-2 text-lg font-black">{data.lastObservation ? format(data.lastObservation.capturedAt) : "記録なし"}</p>
            </section>
            <section className="rounded-2xl border bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
              <p className="text-xs text-slate-500">データ鮮度</p>
              <p className="mt-2 text-lg font-black">{data.lastObservation ? data.lastObservation.status : "未検証"}</p>
            </section>
          </div>
          <section className="rounded-2xl border bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
            <h2 className="font-black">接続状況</h2>
            <dl className="mt-3 space-y-2 text-sm">
              <div className="flex justify-between gap-3"><dt>定時取得</dt><dd>{data.scheduledCaptureConfigured ? "設定済み" : "未設定"}</dd></div>
              <div className="flex justify-between gap-3"><dt>研究DBへの保存</dt><dd>{data.databasePersistenceConfigured ? "設定済み" : "未設定"}</dd></div>
              <div className="flex justify-between gap-3"><dt>データ提供元の利用条件</dt><dd>{data.providerRightsVerified ? "確認済み" : "未確認"}</dd></div>
            </dl>
            <p className="mt-3 break-all text-xs text-slate-500">試験取得元：{data.source}</p>
          </section>
          <section className="rounded-2xl border bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
            <h2 className="font-black">過去の検証履歴</h2>
            {data.history.length === 0 ? <p className="mt-3 text-sm text-slate-500">保存された検証結果はまだありません。未実行と失敗を推測で区別しません。</p> :
              <ul className="mt-3 space-y-2 text-sm">{data.history.map(row => <li key={row.date + row.observedAt}>{row.date}｜{row.status}｜{row.ageMinutes === null ? '不明' : `${row.ageMinutes}分`}</li>)}</ul>}
          </section>
          <section className="rounded-2xl border border-amber-300 bg-white p-4 dark:border-amber-700 dark:bg-slate-900">
            <h2 className="font-black">🧪 開発用DB・保存確定と再試行テスト</h2>
            <p className="mt-2 text-sm leading-6">研究用Preview限定。開発用DBにテスト行を一時保存し、同時処理と再試行を確認して削除します。削除失敗時はテスト行が残る可能性があります。</p>
            <button type="button" onClick={runCommitTest} disabled={testRunning}
              className="mt-3 rounded-xl bg-amber-600 px-4 py-3 text-sm font-bold text-white disabled:opacity-50">
              {testRunning ? "検証中…" : "確認してテストを実行"}
            </button>
            {testResult && <div role="status" className="mt-3 rounded-xl bg-slate-100 p-3 text-sm text-slate-900 dark:bg-slate-800 dark:text-white">
              <p className="font-bold">{testResult.success === true && testResult.cleanupVerified === true ? "検証成功・削除確認済み" : "検証未完了／要確認"}</p>
              <p className="mt-1">保存確定：{String(testResult.committed ?? "不明")} ／ 競合防止：{String(testResult.concurrentBlocked ?? "不明")} ／ 再試行：{String(testResult.retryAcquired ?? "不明")} ／ 削除確認：{String(testResult.cleanupVerified ?? "不明")}</p>
              {testResult.success !== true && <p className="mt-2 font-bold text-red-700 dark:text-red-300">失敗または通信切断。自動で再実行せず、開発用DBの残存データを確認してください。</p>}
              <details className="mt-2"><summary>詳細結果</summary><pre className="mt-2 overflow-x-auto text-xs">{JSON.stringify(testResult, null, 2)}</pre></details>
            </div>}
          </section>
          <p className="text-xs text-slate-500">本番のAI POWER・通知・注文には接続しません。画面確認時刻：{format(data.asOf)}</p>
        </>}
      </div>
    </main>
  );
}
