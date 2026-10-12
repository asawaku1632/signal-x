/**
 * Evidence labels for the private, read-only double-bottom audit.
 * These are observations from a saved decision reason, NOT a fresh signal,
 * a price forecast, or an independent verification of the OHLC chart.
 */
export type DoubleBottomStage =
  | "BREAKOUT_RECORDED"
  | "NEAR_NECKLINE"
  | "REBOUND_ONLY"
  | "INSUFFICIENT";

export const DOUBLE_BOTTOM_STAGES: Array<{
  value: DoubleBottomStage;
  name: string;
  detail: string;
}> = [
  {
    value: "BREAKOUT_RECORDED",
    name: "突破記録あり",
    detail: "保存された判定理由に「ネックラインを上抜け」とある",
  },
  {
    value: "NEAR_NECKLINE",
    name: "ネックライン付近",
    detail: "保存された判定理由に「ネックライン付近まで回復」とある",
  },
  {
    value: "REBOUND_ONLY",
    name: "安値から反発・突破未確認",
    detail: "2つの安値の記録はあるが、突破やネックライン付近への回復の理由はない",
  },
  {
    value: "INSUFFICIENT",
    name: "理由不足・判定不能",
    detail: "この銘柄について必要な判定理由を取得できない",
  },
];

export function classifyDoubleBottomReasons(
  reasons: readonly string[] | null | undefined,
): DoubleBottomStage {
  if (!reasons?.length) return "INSUFFICIENT";
  if (reasons.includes("ネックラインを上抜け")) return "BREAKOUT_RECORDED";
  if (reasons.includes("ネックライン付近まで回復")) return "NEAR_NECKLINE";
  if (reasons.includes("近い価格帯で2回下げ止まり")) return "REBOUND_ONLY";
  return "INSUFFICIENT";
}

export function doubleBottomStageLabel(stage: DoubleBottomStage): string {
  return DOUBLE_BOTTOM_STAGES.find((item) => item.value === stage)?.name ?? "理由不足・判定不能";
}
