/** Optional owner-only execution notes; not a market-data source. */
export type ExecutionNotes = {
  executedAtJst: string | null;
  limitPrice: number | null;
  reason: string | null;
  unableToMonitor: boolean;
};
export function validateExecutionNotes(input: ExecutionNotes, saleDate: string): string | null {
  if (input.executedAtJst !== null) {
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(input.executedAtJst)) {
      return "約定日時は日本時間で入力してください";
    }
    const [date, time] = input.executedAtJst.split("T");
    const [year, month, day] = date.split("-").map(Number);
    const normalizedDate = new Date(Date.UTC(year, month - 1, day)).toISOString().slice(0, 10);
    const [hour, minute, second = "0"] = time.split(":").map(Number);
    if (normalizedDate !== date || date !== saleDate || hour > 23 || minute > 59 || Number(second) > 59) {
      return "約定日時と売却日を確認してください";
    }
  }
  if (input.limitPrice !== null && (!Number.isFinite(input.limitPrice) || input.limitPrice <= 0)) {
    return "指値価格を確認してください";
  }
  if (input.reason !== null && (input.reason.length > 500 || input.reason.includes("\u0000"))) {
    return "売却理由は500文字以内で入力してください";
  }
  if (typeof input.unableToMonitor !== "boolean") return "監視状況を確認してください";
  return null;
}
