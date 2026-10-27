"use client";

import Link from "next/link";
import Step27OfflinePanel from "./step27-offline-panel";
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

export default function MarketIndexResearchClient() {
  const [data, setData] = useState<ResearchStatus | null>(null);
  const [error, setError] = useState("");
  const [dashboard, setDashboard] = useState<{ sourceState: string; hasLiveEvidence: boolean; model: { status: string; total: number; manualReviewCandidates: number; blocked: number; warnings: string[] }; readiness: { mode: string; productionEnabled: boolean; officialPersistenceEnabled: boolean; items: Array<{ code: string; label: string; state: string; explanation: string }>; blockers: string[] }; providerReview: { status: string; eligibleForProduction: boolean; evidenceAuthenticated: boolean; issues: string[]; questions: Array<{ key: string; label: string }> }; licenseResponse: { status: string; authenticated: boolean; authorizedForProduction: boolean; missingOrUnverified: string[] }; connectionPlan: { mode: string; readiness: string; allowNetworkFetch: boolean; allowDatabaseWrite: boolean; allowCron: boolean; allowProductionIntegration: boolean; blockers: string[] }; safetyAudit: { mode: string; state: string; mayFetch: boolean; mayPersist: boolean; maySchedule: boolean; mayUseInProduction: boolean; findings: string[] }; safetyExplanations: { mode: string; decision: string; actionsEnabled: boolean; total: number; entries: Array<{ code: string; description: string; category: string }> }; evidenceChecklist: { mode: string; state: string; canConnect: boolean; canStore: boolean; canSchedule: boolean; canPublish: boolean; confirmedClaims: number; remaining: Array<{ code: string; label: string }> } } | null>(null);
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
  const [auditRunning, setAuditRunning] = useState(false);
  const [auditResult, setAuditResult] = useState<{
    success: boolean; decision?: string; groupCount?: number; duplicateGroups?: number;
    asOf?: string; reason?: string;
    groups?: Array<{ jst_date: string; index_key: string; saved_count: number; result: string }>;
    saved?: boolean; history?: Array<{ audited_at: string; group_count: number; duplicate_group_count: number; decision: string }>;
    todayAuditStatus?: "SAVED_TODAY" | "NOT_SAVED_TODAY";
    comparison?: { baselineAt: string | null; status: "NO_BASELINE" | "UNCHANGED" | "CHANGED"; changes: Array<{ key: string; type: string; before: number | null; after: number | null }> };
    investigation?: { state: "NO_DATA" | "INVESTIGATE" | "NO_BASELINE" | "REVIEW_CHANGES" | "STABLE"; items: Array<{ code: string; key?: string; action: string }> };
    historyAnalysis?: { snapshotCount: number; comparableTransitions: number; status: "INSUFFICIENT_HISTORY" | "REPEATED_ISSUES" | "NO_REPEATED_ISSUES_OBSERVED"; repeated: Array<{ key: string; count: number }>; note: string };
    nextStep?: { state: "INVESTIGATE" | "INSUFFICIENT_EVIDENCE" | "REVIEW_CHANGES" | "CONTINUE_MONITORING"; reason: string; action: string };
  } | null>(null);
  const runDuplicateAudit = async (save = false) => {
    if (save && !window.confirm("開発用DBに監査結果のスナップショットを1件保存します。履歴は自動削除されません。実行しますか？")) return;
    if (auditRunning) return;
    setAuditRunning(true);
    setAuditResult(null);
    try {
      const response = await fetch("/api/admin/market-index-research/duplicate-audit", {
        method: save ? "POST" : "GET", cache: "no-store", credentials: "same-origin",
      });
      const result = await response.json();
      setAuditResult(response.ok ? result : { success: false, reason: result.reason ?? "AUDIT_FAILED" });
    } catch {
      setAuditResult({ success: false, reason: "NETWORK_ERROR" });
    } finally {
      setAuditRunning(false);
    }
  };
  const [manualRunning, setManualRunning] = useState(false);
  const [manualResults, setManualResults] = useState<Array<Record<string, unknown>>>([]);
  const runManualSave = async () => {
    if (manualRunning || manualResults.length >= 2) return;
    if (!window.confirm("開発用DBに日経平均の取得不可ステータスを保存します。研究履歴として残り、自動削除されません。実行しますか？")) return;
    setManualRunning(true);
    try {
      const response = await fetch("/api/admin/market-index-research", {
        method: "POST", credentials: "same-origin", cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "save-unavailable-status", indexKey: "nikkei" }),
      });
      const json = await response.json();
      setManualResults(previous => [...previous, { ...json, httpStatus: response.status }]);
    } catch {
      setManualResults(previous => [...previous, { success: false, reason: "NETWORK_ERROR_OR_TIMEOUT" }]);
    } finally {
      setManualRunning(false);
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
        if (result.success !== true || result.sourceState !== "NO_CONNECTED_EVIDENCE" || result.hasLiveEvidence !== false || result.model?.status !== "research_only" || result.readiness?.productionEnabled !== false || result.readiness?.officialPersistenceEnabled !== false || !Array.isArray(result.readiness?.items) || result.providerReview?.eligibleForProduction !== false || result.providerReview?.evidenceAuthenticated !== false || !Array.isArray(result.providerReview?.questions) || result.licenseResponse?.authenticated !== false || result.licenseResponse?.authorizedForProduction !== false || !Array.isArray(result.licenseResponse?.missingOrUnverified) || result.connectionPlan?.allowNetworkFetch !== false || result.connectionPlan?.allowDatabaseWrite !== false || result.connectionPlan?.allowCron !== false || result.connectionPlan?.allowProductionIntegration !== false || !Array.isArray(result.connectionPlan?.blockers) || result.safetyAudit?.state !== "blocked" || result.safetyAudit?.mayFetch !== false || result.safetyAudit?.mayPersist !== false || result.safetyAudit?.maySchedule !== false || result.safetyAudit?.mayUseInProduction !== false || !Array.isArray(result.safetyAudit?.findings) || result.safetyExplanations?.decision !== "blocked" || result.safetyExplanations?.actionsEnabled !== false || !Array.isArray(result.safetyExplanations?.entries) || result.evidenceChecklist?.state !== "blocked" || result.evidenceChecklist?.canConnect !== false || result.evidenceChecklist?.canStore !== false || result.evidenceChecklist?.canSchedule !== false || result.evidenceChecklist?.canPublish !== false || !Array.isArray(result.evidenceChecklist?.remaining)) {
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
        <Step27OfflinePanel />
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
          <section className="rounded-2xl border bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
            <h2 className="font-black">🔎 開発用DB・重複監査（読み取り専用）</h2>
            <p className="mt-2 text-sm">日経平均・TOPIXの取得不可ステータスだけを日付別に集計します。外部市場データの取得・DB書き込み・自動実行はありません。</p>
            <button type="button" onClick={() => runDuplicateAudit(false)} disabled={auditRunning}
              className="mt-3 rounded-xl bg-slate-800 px-4 py-3 text-sm font-bold text-white disabled:opacity-50">
              {auditRunning ? "監査中…" : "保存履歴の重複を確認する"}
            </button>
            <button type="button" onClick={() => runDuplicateAudit(true)} disabled={auditRunning}
              className="ml-2 mt-3 rounded-xl border border-slate-400 px-4 py-3 text-sm font-bold disabled:opacity-50">
              {auditRunning ? "処理中…" : "監査して履歴に保存（確認あり）"}
            </button>
            {auditResult && <div role="status" className="mt-3 rounded-lg bg-slate-100 p-3 text-sm text-slate-900 dark:bg-slate-800 dark:text-white">
              <p className="font-bold">{!auditResult.success ? "監査失敗・判定不可" : auditResult.decision === "PASS" ? "監査PASS（対象の重複なし）" : auditResult.decision === "NO_DATA" ? "対象データなし・判定保留" : "重複を検出・要調査"}</p>
              {auditResult.success ? <>
                <p className="mt-1">対象グループ：{auditResult.groupCount} ／ 重複グループ：{auditResult.duplicateGroups} ／ 確認時刻：{auditResult.asOf ? new Date(auditResult.asOf).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" }) : "不明"}</p>
                <p className="mt-1">{auditResult.saved ? "今回の監査結果を開発用DBに保存しました。" : "今回は読み取りのみで、監査履歴は保存していません。"}</p>
                <div className="mt-3 rounded-lg border border-slate-300 p-3 dark:border-slate-600">
                  <p className="font-bold">前回保存結果との比較</p>
                  <p className="mt-1">当日の保存状況：{auditResult.todayAuditStatus === "SAVED_TODAY" ? "保存済み" : "未実行（本日分の保存履歴なし）"}</p>
                  <p className="mt-1">比較結果：{auditResult.comparison?.status === "NO_BASELINE" ? "比較元なし（初回）" : auditResult.comparison?.status === "UNCHANGED" ? "前回から変化なし" : "前回から変化あり・確認が必要"}</p>
                  {auditResult.comparison?.baselineAt && <p className="mt-1">比較元：{new Date(auditResult.comparison.baselineAt).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" })}</p>}
                  {auditResult.comparison?.changes?.length ? <ul className="mt-2 space-y-1">{auditResult.comparison.changes.map(c =>
                    <li key={c.key + c.type}>{c.key} ／ {c.type === "ADDED" ? "新規" : c.type === "MISSING" ? "前回記録から消失" : "件数変更"} ／ {c.before ?? "なし"} → {c.after ?? "なし"}</li>
                  )}</ul> : null}
                  {auditResult.decision === "DUPLICATE_DETECTED" && <p className="mt-2 font-bold text-red-600">重複あり：追加の保存テストを停止し、対象日付・指数の記録を調査してください。自動削除は行いません。</p>}
                  <p className="mt-2 text-xs">「未実行」は当日の保存履歴がない意味です。読み取り監査を実施したかどうかは判定できません。差分は保存済み監査時点との比較で、市場データの品質判定ではありません。</p>
                </div>
                {auditResult.investigation && <div className="mt-3 rounded-lg border border-amber-300 p-3 dark:border-amber-700">
                  <p className="font-bold">STEP27-C｜調査分類（管理者確認用）</p>
                  <p className="mt-1">分類：{({
                    STABLE: "変化なし・監視継続",
                    REVIEW_CHANGES: "追加履歴を確認",
                    INVESTIGATE: "要調査",
                    NO_DATA: "対象データなし・判定保留",
                    NO_BASELINE: "比較元なし・保存履歴を確認",
                  } as Record<string, string>)[auditResult.investigation.state] ?? "判定不明"}</p>
                  {auditResult.investigation.items.length > 0 && <ul className="mt-2 space-y-1">{auditResult.investigation.items.map((item, i) =>
                    <li key={item.code + "-" + (item.key ?? i)}>{item.key ? item.key + " ／ " : ""}{item.code}：{item.action}</li>
                  )}</ul>}
                  <p className="mt-2 text-xs">研究用の調査案内です。株価品質・売買判断・本番AIへの反映を承認するものではありません。自動修正・自動保存は行いません。</p>
                </div>}
                {auditResult.historyAnalysis && <div className="mt-3 rounded-lg border border-slate-300 p-3 dark:border-slate-600">
                  <p className="font-bold">STEP27-D｜保存済み監査履歴の再発分析</p>
                  <p className="mt-1">保存スナップショット：{auditResult.historyAnalysis.snapshotCount}件 ／ 比較可能な遷移：{auditResult.historyAnalysis.comparableTransitions}件</p>
                  <p className="mt-1">判定：{({
                    INSUFFICIENT_HISTORY: "履歴不足・再発判定不可",
                    REPEATED_ISSUES: "同じ問題の繰り返しを検出・要調査",
                    NO_REPEATED_ISSUES_OBSERVED: "保存履歴内で繰り返し未検出",
                  } as Record<string, string>)[auditResult.historyAnalysis.status] ?? "不明"}</p>
                  {auditResult.historyAnalysis.repeated.length > 0 && <ul className="mt-2 space-y-1">{auditResult.historyAnalysis.repeated.map(item =>
                    <li key={item.key}>{item.key} ／ {item.count}回</li>
                  )}</ul>}
                  <p className="mt-2 text-xs">{auditResult.historyAnalysis.note} 市場データの正確性や正式利用の許諾を示すものではありません。</p>
                </div>}
                {auditResult.nextStep && <div className="mt-3 rounded-lg border border-slate-300 p-3 dark:border-slate-600">
                  <p className="font-bold">STEP27-E｜次の管理判断（研究専用）</p>
                  <p className="mt-1">判定：{({
                    INVESTIGATE: "追加調査",
                    INSUFFICIENT_EVIDENCE: "証拠不足・追加検証待ち",
                    REVIEW_CHANGES: "変更内容の確認",
                    CONTINUE_MONITORING: "継続監視",
                  } as Record<string, string>)[auditResult.nextStep.state] ?? "判定不明"}</p>
                  <p className="mt-1">根拠：{auditResult.nextStep.reason}</p>
                  <p className="mt-1">次の行動：{auditResult.nextStep.action}</p>
                  <p className="mt-2 text-xs">管理者向けの研究上の案内です。自動保存・自動修正・本番AI・売買判定・通知には接続しません。</p>
                </div>}
                <div className="mt-2"><p className="font-bold">直近の保存済み監査履歴（最大20件）</p>
                  <ul className="space-y-1">{auditResult.history?.map((h, i) =>
                    <li key={h.audited_at + "-" + i}>{new Date(h.audited_at).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" })} ／ {h.decision} ／ {h.group_count}グループ ／ 重複{h.duplicate_group_count}</li>
                  )}</ul>
                </div>
                <ul className="mt-2 space-y-1">{auditResult.groups?.map((row) =>
                  <li key={row.jst_date + "-" + row.index_key}>{row.jst_date} ／ {row.index_key} ／ {row.saved_count}件 ／ {row.result}</li>
                )}</ul>
              </> : <p className="mt-1">理由：{auditResult.reason ?? "UNKNOWN"}</p>}
            </div>}
          </section>
          <section className="rounded-2xl border border-blue-300 bg-white p-4 dark:border-blue-700 dark:bg-slate-900">
            <h2 className="font-black">🧪 手動保存・重複防止の実測（開発用DBのみ）</h2>
            <p className="mt-2 text-sm">日経平均の「取得不可」状態だけを保存します。市場価格は取得しません。保存した研究履歴は自動削除されません。</p>
            <p className="mt-2 text-sm font-bold">1回目と2回目を個別に実行し、2回目の alreadySaved=true と persistedRows=0 を確認します。</p>
            <button type="button" onClick={runManualSave} disabled={manualRunning || manualResults.length >= 2 || (manualResults.length === 1 && (manualResults[0].success !== true || manualResults[0].httpStatus !== 200))}
              className="mt-3 rounded-xl bg-blue-700 px-4 py-3 text-sm font-bold text-white disabled:opacity-50">
              {manualRunning ? "保存中…" : manualResults.length === 0 ? "1回目：日経平均を手動保存" : manualResults.length === 1 ? "2回目：同日の重複防止を確認" : "2回の検証完了"}
            </button>
            {manualResults.map((result, index) => <div key={index} role="status" className="mt-3 rounded-lg bg-slate-100 p-3 text-sm dark:bg-slate-800">
              <p className="font-bold">{index + 1}回目：{result.success === true ? "API成功" : "失敗・要確認"}</p>
              <p>alreadySaved: {String(result.alreadySaved ?? "不明")} ／ persistedRows: {String(result.persistedRows ?? "不明")}</p>
              <details className="mt-1"><summary>詳細結果</summary><pre className="overflow-x-auto text-xs">{JSON.stringify(result, null, 2)}</pre></details>
            </div>)}
            {manualResults.length === 2 && <p className="mt-3 font-bold">{manualResults[0].success === true && manualResults[1].success === true && manualResults[1].alreadySaved === true && manualResults[1].persistedRows === 0 ? "重複防止のAPI応答を確認。DB実件数は別途SQLで検証してください。" : "判定保留。DBを確認し、再実行しないでください。"}</p>}
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
            <div className="mt-3 rounded-lg border p-3 text-sm dark:border-slate-700">
              <p className="font-bold">公式の利用条件・確認先</p>
              <ul className="mt-2 list-disc space-y-2 pl-5">
                <li><a href="https://indexes.nikkei.co.jp/nkave/license/index.en.html" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">日経平均：日経指数のライセンス案内</a>（許諾未取得）</li>
                <li><a href="https://www.jpx.co.jp/markets/indices/licence/" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">TOPIX：JPX総研の指数ライセンス案内</a>（許諾未取得）</li>
              </ul>
              <p className="mt-2 text-xs text-slate-600 dark:text-slate-300">アプリ内表示だけでなく、自動処理・保存・派生分析・有料配信の可否をそれぞれ確認する必要があります。公開情報は契約証拠ではありません。</p>
            </div>
            <div className="mt-3 rounded-lg border p-3 text-sm dark:border-slate-700">
              <p className="font-bold">問い合わせ前の確認（STEP 421〜440）</p>
              <p className="mt-1">日経平均は表示利用と機械処理の利用条件を分けて確認。TOPIXは第三者提供・商用利用の条件を確認します。</p>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                <li>Web・Androidの無料／有料表示と再配信</li>
                <li>AI分析への入力、派生指標、研究利用</li>
                <li>履歴保存・保持期間・データ取得方法と費用</li>
                <li>取引日カレンダー、出典表示、契約終了時の取り扱い</li>
              </ul>
              <p className="mt-2 font-bold">問い合わせ：未送信 ／ 契約：未締結 ／ 正式取得：無効</p>
            </div>
            <div className="mt-3 rounded-lg border p-3 text-sm dark:border-slate-700">
              <p className="font-bold">✉ 問い合わせ準備（STEP 441〜460）</p>
              <p className="mt-2">日経平均・TOPIXそれぞれの問い合わせ文案を研究資料として保存しました。送信や契約は行っていません。</p>
              <p className="mt-2 font-bold">返信：未受領 ／ 契約証拠：未確認 ／ 正式保存：無効</p>
              <p className="mt-2 text-xs text-slate-600 dark:text-slate-300">回答を受領しても、表示・非表示利用、保存、再配信、有料提供、派生分析の許諾範囲が確認できるまでは正式運用を開始しません。</p>
            </div>
            <div className="mt-3 rounded-lg border p-3 text-sm dark:border-slate-700">
              <p className="font-bold">✉️ 問い合わせ文案（STEP 441〜460）</p>
              <p className="mt-1">日経平均とTOPIX、それぞれの権利元向けに別々の問い合わせ文案を用意しました。送信先・担当者・料金・契約条件は未確認です。</p>
              <a href="https://github.com/asawaku1632/signal-x/blob/research/market-index-shadow-20261021/docs/research/market-index-step441-460-license-inquiry-drafts.md" target="_blank" rel="noopener noreferrer" className="mt-2 inline-block text-blue-600 underline">研究用の問い合わせ文案を見る（GitHub）</a>
              <p className="mt-2 font-bold">送信：未実施 ／ 回答：未受領 ／ 許諾：未確認</p>
              <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">契約書や返信の原文を公開リポジトリに登録しないでください。</p>
            </div>
            <p className="mt-3 text-xs text-slate-600 dark:text-slate-300">このチェックリストは研究用の表示のみ。外部データ取得・自動保存・本番反映は行いません。</p>
          </section>}
          {dashboard?.licenseResponse && <section className="rounded-2xl border bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
            <h2 className="font-black">📨 ライセンス回答確認（STEP 461〜480）</h2>
            <p className="mt-2 text-sm font-bold">回答：未受領 ／ 契約証拠：未確認 ／ 正式利用：不可</p>
            <p className="mt-1 text-sm">返信が届いた場合も、署名権限、対象指数、表示・自動処理・保存・再配信・有料利用、契約期間、失効状況の独立確認が必要です。</p>
            <p className="mt-2 text-xs text-slate-600 dark:text-slate-300">未確認条件：{dashboard.licenseResponse.missingOrUnverified.length}項目。研究用の固定未接続状態を表示しています。メールや契約書を取得・保存する機能ではありません。</p>
          </section>}
          {dashboard?.connectionPlan && <section className="rounded-2xl border bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
            <h2 className="font-black">🔐 正式データ接続の条件（STEP 481〜500）</h2>
            <p className="mt-2 text-sm font-bold">外部取得：無効 ／ DB正式保存：無効 ／ 定時実行：無効 ／ 本番連携：無効</p>
            <p className="mt-1 text-sm">契約証拠・営業日・正規フィード・品質・保存範囲・再配信・運用承認の各条件が必要です。条件がすべて入力されても、この研究用ロジックは接続を許可しません。</p>
            <p className="mt-2 text-xs text-slate-600 dark:text-slate-300">未確認の接続条件：{dashboard.connectionPlan.blockers.length}件。APIが返す研究用の固定未接続状態であり、契約や取得の証拠ではありません。</p>
          </section>}
          {dashboard?.safetyAudit && <section className="rounded-2xl border bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
            <h2 className="font-black">🛡️ 研究用安全監査（STEP 501〜520）</h2>
            <p className="mt-2 text-sm font-bold">取得・保存・定時実行・本番連携：すべて無効</p>
            <p className="mt-1 text-sm">契約回答と接続設定の矛盾を確認する読み取り専用の監査です。現在は未接続の固定状態で評価しています。</p>
            <p className="mt-2 text-xs text-slate-600 dark:text-slate-300">未解決・要確認事項：{dashboard.safetyAudit.findings.length}件。入力した条件がすべて揃っても、この監査結果だけで運用は開始できません。</p>
          </section>}
          {dashboard?.safetyExplanations && <section className="rounded-2xl border bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
            <h2 className="font-black">🛡️ 安全性監査・未確認事項（STEP 521〜540）</h2>
            <p className="mt-2 text-sm font-bold">判定：ブロック ／ 正式データ取得・保存・本番連携：無効</p>
            <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">契約文面や個人情報を表示せず、研究用APIが返す未確認条件だけを説明します。</p>
            <ul className="mt-3 space-y-2 text-sm">{dashboard.safetyExplanations.entries.map(item => <li key={item.code} className="rounded-lg border p-2 dark:border-slate-700">
              <span className="font-bold">{item.description}</span>
              <span className="ml-2 text-xs text-slate-500">({item.code})</span>
            </li>)}</ul>
          </section>}
          {dashboard?.evidenceChecklist && <section className="rounded-2xl border bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
            <h2 className="font-black">📋 正式利用までの残課題（STEP 541〜580）</h2>
            <p className="mt-2 text-sm font-bold">正式証拠：未接続 ／ 外部取得・保存・本番連携：無効</p>
            <p className="mt-1 text-sm">これは研究用の固定チェックリストです。確認済みと自己申告しても、利用許諾や本番運用の承認にはなりません。</p>
            <ul className="mt-3 space-y-2 text-sm">{dashboard.evidenceChecklist.remaining.map(item => <li key={item.code} className="rounded-lg border p-2 dark:border-slate-700">
              <span>{item.label}</span>
              <span className="ml-2 text-xs text-slate-500">未確認</span>
            </li>)}</ul>
            <a href="https://github.com/asawaku1632/signal-x/blob/research/market-index-shadow-20261021/docs/research/market-index-step541-560-open-dependencies.md" target="_blank" rel="noopener noreferrer" className="mt-3 inline-block text-blue-600 underline">残課題と進行順序の資料を見る</a>
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
