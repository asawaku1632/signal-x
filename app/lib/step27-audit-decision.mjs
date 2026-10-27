// STEP27-E: manual guidance derived from read-only audit results.
export function decideAuditNextStep(investigation, history) {
  if (investigation?.state === "INVESTIGATE" || history?.status === "REPEATED_ISSUES")
    return { state: "INVESTIGATE", reason: "現在または過去の監査で要調査の兆候があります。", action: "対象の保存履歴と重複防止条件を手動確認してください。" };
  if (!history || history.snapshotCount < 2 || ["NO_DATA", "NO_BASELINE"].includes(investigation?.state))
    return { state: "INSUFFICIENT_EVIDENCE", reason: "比較可能な保存済み監査履歴が不足しています。", action: "独立した機会の監査を待ってください。同じ結果の再保存で件数を増やす必要はありません。" };
  if (investigation?.state === "REVIEW_CHANGES")
    return { state: "REVIEW_CHANGES", reason: "新規履歴の追加を検出しました。", action: "通常の履歴追加か手動確認してください。" };
  return { state: "CONTINUE_MONITORING", reason: "利用可能な監査履歴では要調査の兆候がありません。", action: "読み取り監査を継続してください。" };
}
