// STEP27-D: historical audit snapshots only. Pure, read-only analysis.
import { compareAuditGroups, classifyAuditInvestigation } from "./step27-audit-comparison.mjs";

export function analyzeAuditHistory(history) {
  const snapshots = history.filter(h => Array.isArray(h.details))
    .slice().sort((a, b) => Date.parse(a.audited_at) - Date.parse(b.audited_at));
  const findings = [];
  for (let i = 0; i < snapshots.length; i++) {
    const current = snapshots[i];
    const previous = i > 0 ? snapshots[i - 1] : null;
    const comparison = previous ? compareAuditGroups(previous.details, current.details) : null;
    const investigation = classifyAuditInvestigation(comparison, current.details);
    findings.push({ auditedAt: current.audited_at, state: investigation.state,
      issues: investigation.items.filter(item => ["DUPLICATE", "COUNT_CHANGED", "MISSING"].includes(item.code))
        .map(item => ({ code: item.code, key: item.key ?? null })) });
  }
  const issueCounts = new Map();
  for (const finding of findings) for (const issue of finding.issues) {
    const key = issue.code + ":" + (issue.key ?? "");
    issueCounts.set(key, (issueCounts.get(key) ?? 0) + 1);
  }
  const repeated = [...issueCounts].filter(([, count]) => count > 1)
    .map(([key, count]) => ({ key, count }));
  return {
    snapshotCount: snapshots.length,
    comparableTransitions: Math.max(0, snapshots.length - 1),
    status: snapshots.length < 2 ? "INSUFFICIENT_HISTORY" : repeated.length ? "REPEATED_ISSUES" : "NO_REPEATED_ISSUES_OBSERVED",
    repeated,
    findings,
    note: "保存済み監査スナップショット間だけの比較。未保存の読み取り監査は含みません。"
  };
}
