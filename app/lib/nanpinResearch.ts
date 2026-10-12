/**
 * Experimental read-only interpretation of existing SIGNALX indicators.
 * NOT trained/validated for averaging-down; never writes positions or signals.
 * Never treat a hypothetical or stale quote as a live trading recommendation.
 */
export type NanpinResearchInput = {
  entryPrice: number;
  addPrice: number;
  initialCost: number;
  additionalCost: number;
  referencePrice: number | null;
  snapshotUpdatedAt: string | null;
  snapshotStale: boolean;
  aiPower: number | null;
  rsi: number | null;
  changePercent: number | null;
  volumeRatio: number | null;
  stopLoss?: number | null;
};

export type NanpinResearchStatus = "NO_DATA" | "NOT_NANPIN" | "RISK" | "WAIT" | "WATCH";
export type NanpinResearchResult = {
  status: NanpinResearchStatus;
  label: string;
  explanation: string;
  reasons: string[];
};

const valid = (value: number | null | undefined): value is number =>
  typeof value === "number" && Number.isFinite(value);
const response = (status: NanpinResearchStatus, label: string, explanation: string, reasons: string[]): NanpinResearchResult =>
  ({ status, label, explanation, reasons });

export function evaluateNanpinResearch(input: NanpinResearchInput): NanpinResearchResult {
  if (![input.entryPrice, input.addPrice, input.initialCost, input.additionalCost].every(Number.isFinite) ||
      input.entryPrice <= 0 || input.addPrice <= 0 || input.initialCost <= 0 || input.additionalCost <= 0) {
    return response("NO_DATA", "入力を確認", "価格・株数を確認してください。", []);
  }
  if (input.addPrice >= input.entryPrice) {
    return response("NOT_NANPIN", "通常の買い増し", "購入単価より低い価格で買っていないため、ナンピン判定の対象外です。", []);
  }
  const updatedAtMs = input.snapshotUpdatedAt ? Date.parse(input.snapshotUpdatedAt) : NaN;
  if (input.snapshotStale || !Number.isFinite(updatedAtMs) || updatedAtMs > Date.now() + 60_000) {
    return response("NO_DATA", "データ確認待ち", "保存株価が古いか取得日時を確認できないため、判定を出しません。", []);
  }
  if (!valid(input.referencePrice) || input.referencePrice <= 0) {
    return response("NO_DATA", "参考株価なし", "銘柄の参考株価がありません。損益の試算だけ利用できます。", []);
  }
  if (Math.abs(input.addPrice - input.referencePrice) / input.referencePrice > 0.01) {
    return response("NO_DATA", "想定価格のため保留", "買い増し予定価格と取得済み参考株価が1%を超えて異なります。現在の指標では将来の指値を判定できません。", []);
  }
  const missing = [
    !valid(input.aiPower) || input.aiPower < 0 || input.aiPower > 100 ? "AI POWER" : null,
    !valid(input.rsi) || input.rsi < 0 || input.rsi > 100 ? "RSI" : null,
    !valid(input.changePercent) ? "当日変化率" : null,
    !valid(input.volumeRatio) || input.volumeRatio < 0 ? "出来高倍率" : null,
  ].filter((v): v is string => v !== null);
  if (missing.length) {
    return response("NO_DATA", "分析材料が不足", "必要な指標がそろうまで判定を保留します。", [`不足：${missing.join("・")}`]);
  }

  // The checks above established these four indicators are valid numbers.
  const aiPower = input.aiPower as number;
  const rsi = input.rsi as number;
  const change = input.changePercent as number;
  const volume = input.volumeRatio as number;
  const funding = `追加資金は元の購入資金の${(input.additionalCost / input.initialCost * 100).toFixed(0)}%`;
  const risks: string[] = [];
  if (valid(input.stopLoss) && input.stopLoss > 0 && input.referencePrice <= input.stopLoss)
    risks.push("既存の損切り目安を下回っています");
  if (change <= -3) risks.push(`当日${change.toFixed(2)}%の急落`);
  if (aiPower < 60) risks.push(`AI POWER ${Math.round(aiPower)}（低水準）`);
  if (rsi >= 75) risks.push(`RSI ${Math.round(rsi)}（過熱）`);
  if (risks.length) return response(
    "RISK", "見送りを優先して確認", "下落継続や過熱の兆候があります。平均単価の低下だけを根拠に買い増ししないでください。",
    [...risks, funding],
  );
  if (aiPower >= 85 && rsi >= 35 && rsi <= 65 && change >= 0 && volume >= 1.1) {
    return response(
      "WATCH", "反発兆候の観察候補", "いくつかの指標がそろっています。買い推奨ではなく、反発が続くかチャートで監視する段階です。",
      [`AI POWER ${Math.round(aiPower)}`, `RSI ${Math.round(rsi)}`, `当日変化率 +${change.toFixed(2)}%`, `出来高倍率 ${volume.toFixed(2)}倍`, funding],
    );
  }
  return response(
    "WAIT", "追加材料待ち", "反発条件が十分にそろっていません。買い増しせずに様子を見る場合との損益比較を確認してください。",
    [`AI POWER ${Math.round(aiPower)}・RSI ${Math.round(rsi)}`, `当日変化率 ${change.toFixed(2)}%・出来高倍率 ${volume.toFixed(2)}倍`, funding],
  );
}
