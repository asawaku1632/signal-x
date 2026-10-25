/**
 * STEP 561-580: pure research-only checklist of externally verified artifacts.
 * User-supplied booleans are untrusted. This NEVER grants permission.
 */
export const INDEX_EVIDENCE_REQUIREMENTS = [
  { code: "NIKKEI_LICENSE", label: "日経平均の正式な利用許諾" },
  { code: "TOPIX_LICENSE", label: "TOPIXの正式な利用許諾" },
  { code: "DATA_VENDOR", label: "正規のデータ配信契約" },
  { code: "DISPLAY_SCOPE", label: "Web・Android表示と第三者配信の利用範囲" },
  { code: "NONDISPLAY_SCOPE", label: "自動処理・AI分析の利用範囲" },
  { code: "STORAGE_SCOPE", label: "履歴保存・キャッシュ・保持期間" },
  { code: "PAID_SCOPE", label: "有料ユーザー向け利用範囲" },
  { code: "CALENDAR_SOURCE", label: "正規の取引日カレンダー" },
  { code: "OPERATIONAL_REVIEW", label: "運用・停止手順と責任者承認" },
] as const;
export type IndexEvidenceCode = typeof INDEX_EVIDENCE_REQUIREMENTS[number]["code"];
export type IndexEvidenceChecklist = {
  mode: "research_only";
  state: "blocked";
  canConnect: false;
  canStore: false;
  canSchedule: false;
  canPublish: false;
  confirmedClaims: number;
  remaining: { code: IndexEvidenceCode; label: string }[];
};
export function assessIndexEvidenceChecklist(claims: unknown): IndexEvidenceChecklist {
  const obj = claims && typeof claims === "object" && !Array.isArray(claims)
    ? claims as Record<string, unknown> : {};
  const remaining = INDEX_EVIDENCE_REQUIREMENTS
    .filter(x => obj[x.code] !== true)
    .map(x => ({ code: x.code, label: x.label }));
  return {
    mode: "research_only",
    state: "blocked",
    canConnect: false,
    canStore: false,
    canSchedule: false,
    canPublish: false,
    confirmedClaims: INDEX_EVIDENCE_REQUIREMENTS.length - remaining.length,
    remaining,
  };
}
