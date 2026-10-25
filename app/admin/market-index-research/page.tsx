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
  const [dashboard, setDashboard] = useState<{ sourceState: string; hasLiveEvidence: boolean; model: { status: string; total: number; manualReviewCandidates: number; blocked: number; warnings: string[] }; readiness: { mode: string; productionEnabled: boolean; officialPersistenceEnabled: boolean; items: Array<{ code: string; label: string; state: string; explanation: string }>; blockers: string[] }; providerReview: { status: string; eligibleForProduction: boolean; evidenceAuthenticated: boolean; issues: string[]; questions: Array<{ key: string; label: string }> } } | null>(null);
  const [dashboardError, setDashboardError] = useState("");
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
  useEffect(() => {
    fetch("/api/admin/market-index-research/dashboard", { cache: "no-store", credentials: "same-origin" })
      .then(async response => {
        if (!response.ok) throw new Error("研究集計を取得できません");
        const result = await response.json();
        if (result.success !== true || result.sourceState !== "NO_CONNECTED_EVIDENCE" || result.hasLiveEvidence !== false || result.model?.status !== "research_only" || result.readiness?.productionEnabled !== false || result.readiness?.officialPersistenceEnabled !== false || !Array.isArray(result.readiness?.items) || result.providerReview?.eligibleForProduction !== false || result.providerReview?.evidenceAuthenticated !== false || !Array.isArray(result.providerReview?.questions)) {
          throw new Error("研究集計の安全な状態を確認できません");
        }
        setDashboard(result);
      })
      .catch(() => setDashboardError("研究集計は確認できません。未接続のままです。"));
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
            <h2 className="font-black">🔎 証拠チェック集計（研究専用）</h2>
            <p className="mt-2 text-sm">実際の許諾証拠・取引日カレンダーは未接続。表示する件数は実市場データの検証件数ではありません。</p>
            {dashboardError && <p role="alert" className="mt-2 text-sm text-red-700">{dashboardError}</p>}
            {!dashboard && !dashboardError && <p className="mt-2 text-sm">集計状態を確認中…</p>}
            {dashboard && <div className="mt-3 space-y-2 text-sm">
              <p className="font-bold">状態：未接続（研究用）</p>
              <p>接続済み証拠：なし ／ 集計対象：{dashboard.model.total}件 ／ 手動確認候補：{dashboard.model.manualReviewCandidates}件 ／ ブロック：{dashboard.model.blocked}件</p>
              <ul className="list-disc pl-5">{dashboard.model.warnings.map(warning => <li key={warning}>{warning}</li>)}</ul>
            </div>}
          </section>
          <section className="rounded-2xl border bg-white p-4 dark:border-slate-700 dark:bg-slate-900" aria-labelledby="readiness-heading">
            <h2 id="readiness-heading" className="font-black">🧭 正式運用までの確認項目（STEP 341〜360）</h2>
            <p className="mt-2 text-sm leading-6">この一覧は接続状態を確認するための研究用チェックリストです。許諾・取引日・データ品質を自動的に証明するものではありません。</p>
            <ul className="mt-3 space-y-3 text-sm">
              <li className="rounded-lg border p-3 dark:border-slate-700">
                <p className="font-bold">① 提供元の利用許諾：{data.providerRightsVerified ? "設定上は確認済み（証拠の独立検証は未実施）" : "未確認・正式利用不可"}</p>
                <p className="mt-1 text-slate-600 dark:text-slate-300">日経平均・TOPIXの取得、保存、再表示、商用利用について、提供元の契約・権利範囲を確認する必要があります。</p>
              </li>
              <li className="rounded-lg border p-3 dark:border-slate-700">
                <p className="font-bold">② 取引日カレンダー：未検証</p>
                <p className="mt-1 text-slate-600 dark:text-slate-300">休場日、祝日、臨時休場、取引時間帯の根拠となる正式カレンダーは接続されていません。</p>
              </li>
              <li className="rounded-lg border p-3 dark:border-slate-700">
                <p className="font-bold">③ 正式データ・鮮度：未接続</p>
                <p className="mt-1 text-slate-600 dark:text-slate-300">最新の研究記録があっても、status が unavailable の場合は指数値の取得成功とはみなしません。</p>
              </li>
              <li className="rounded-lg border p-3 dark:border-slate-700">
                <p className="font-bold">④ 自動取得・正式保存：無効のまま維持</p>
                <p className="mt-1 text-slate-600 dark:text-slate-300">定時取得は{data.scheduledCaptureConfigured ? "設定あり（正式運用の証拠ではありません）" : "未設定"}。研究DBの保存設定と正式な市場データの保存許可は別です。</p>
              </li>
            </ul>
            <p className="mt-3 rounded-lg bg-amber-50 p-3 text-sm font-bold text-amber-950 dark:bg-amber-950 dark:text-amber-100">判定：正式運用は保留。必要な証拠とデータ品質が確認されるまで、本番AI POWER・通知・注文には接続しません。</p>
          </section>
          {dashboard?.readiness && <section className="rounded-2xl border bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
            <h2 className="font-black">🔒 正式運用ブロッカー（STEP 361〜380）</h2>
            <p className="mt-2 text-sm font-bold">正式保存：無効 ／ 本番接続：無効</p>
            <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">研究用APIの未接続状態から作成した安全側の一覧です。外部証拠の独立確認結果ではありません。</p>
            <ul className="mt-3 space-y-2 text-sm">{dashboard.readiness.items.map(item => <li key={item.code} className="rounded-lg border p-3 dark:border-slate-700">
              <p className="font-bold">{item.label}：{item.state === "blocked" ? "未確認" : "設定あり・要独立検証"}</p>
              <p className="mt-1 text-slate-600 dark:text-slate-300">{item.explanation}</p>
            </li>)}</ul>
          </section>}
          {dashboard?.providerReview && <section className="rounded-2xl border bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
            <h2 className="font-black">📋 データ提供元・利用条件の確認（STEP 381〜400）</h2>
            <p className="mt-2 text-sm font-bold">提供元：未選定 ／ 契約証拠：未接続 ／ 本番利用：不可</p>
            <p className="mt-1 text-sm">正式な日経平均・TOPIXデータの利用には、提供元との契約条件を人が確認する必要があります。下記は確認項目であり、許諾済みという意味ではありません。</p>
            <ul className="mt-3 list-disc space-y-2 pl-5 text-sm">
              <li>日経平均・TOPIXの両指数を対象にできるか</li>
              {dashboard.providerReview.questions.map(q => <li key={q.key}>{q.label}：未確認</li>)}
              <li>契約書・利用許諾の証拠：未確認</li>
              <li>正式な取引日カレンダー：未確認</li>
            </ul>
            <p className="mt-3 text-xs text-slate-600 dark:text-slate-300">このチェックリストは研究用の表示のみ。外部データ取得・自動保存・本番反映は行いません。</p>
          </section>}
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
