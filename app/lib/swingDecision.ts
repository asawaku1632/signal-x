export type SwingDecisionStatus =
  | "NEW_CANDIDATE"
  | "HOLD"
  | "TAKE_PROFIT_WATCH"
  | "EXIT";

export type SwingDecisionInput = {
  currentPrice: number;
  entryPrice?: number | null;
  aiPower?: number | null;
  rsi?: number | null;
  volumeRatio?: number | null;
  changePercent?: number | null;
  takeProfit?: number | null;
  stopLoss?: number | null;
  startedAt?: string | null;
  trackingDays?: number | null;
};

export type SwingDecision = {
  status: SwingDecisionStatus;
  label: string;
  icon: string;
  tone: "blue" | "emerald" | "amber" | "rose";
  summary: string;
  reasons: string[];
  pnlPercent: number | null;
  holdingDays: number | null;
  reviewDue: boolean;
};

const finiteOrNull = (value: unknown) => {
  if (value == null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

export function getHoldingDays(startedAt?: string | null, now = new Date()) {
  if (!startedAt) return null;
  const started = new Date(startedAt);
  if (Number.isNaN(started.getTime())) return null;
  const elapsed = Math.max(0, now.getTime() - started.getTime());
  return Math.floor(elapsed / 86_400_000) + 1;
}

export function getSwingDecision(input: SwingDecisionInput): SwingDecision {
  const currentPrice = finiteOrNull(input.currentPrice) ?? 0;
  const entryPrice = finiteOrNull(input.entryPrice);
  const aiPower = finiteOrNull(input.aiPower);
  const rsi = finiteOrNull(input.rsi);
  const volumeRatio = finiteOrNull(input.volumeRatio);
  const changePercent = finiteOrNull(input.changePercent);
  const takeProfit = finiteOrNull(input.takeProfit);
  const stopLoss = finiteOrNull(input.stopLoss);
  const holdingDays = getHoldingDays(input.startedAt);
  const reviewDue =
    holdingDays != null &&
    input.trackingDays != null &&
    holdingDays >= input.trackingDays;

  if (!entryPrice || entryPrice <= 0) {
    const reasons: string[] = [];
    if (aiPower != null && aiPower >= 80) reasons.push(`AI POWER ${Math.round(aiPower)}で強め`);
    if (rsi != null && rsi >= 35 && rsi <= 70) reasons.push(`RSI ${Math.round(rsi)}で過熱感は限定的`);
    if (volumeRatio != null && volumeRatio >= 1.1) reasons.push("出来高が平常時より増加");
    return {
      status: "NEW_CANDIDATE",
      label: "新規候補",
      icon: "🟢",
      tone: "blue",
      summary:
        aiPower != null && aiPower >= 80
          ? "スイング候補として監視する価値があります。"
          : "新規エントリーは追加シグナルを確認しながら判断します。",
      reasons: reasons.length ? reasons : ["現在のAI分析をもとに候補判定中"],
      pnlPercent: null,
      holdingDays,
      reviewDue,
    };
  }

  const pnlPercent = currentPrice > 0 ? ((currentPrice / entryPrice) - 1) * 100 : 0;
  const reachedStop = stopLoss != null && stopLoss > 0 && currentPrice <= stopLoss;
  const weakAi = aiPower != null && aiPower < 55;
  const severeLoss = pnlPercent <= -3;

  if (reachedStop || severeLoss || weakAi) {
    const reasons: string[] = [];
    if (reachedStop) reasons.push(`損切り目安 ${Math.round(stopLoss!)}円に到達`);
    if (severeLoss) reasons.push(`購入価格から ${pnlPercent.toFixed(2)}%`);
    if (weakAi) reasons.push(`AI POWERが ${Math.round(aiPower!)}まで低下`);
    if (changePercent != null && changePercent < 0) reasons.push(`当日変化率 ${changePercent.toFixed(2)}%`);
    return {
      status: "EXIT",
      label: "撤退候補",
      icon: "🔴",
      tone: "rose",
      summary: "保有継続よりもリスク管理を優先する局面です。",
      reasons,
      pnlPercent,
      holdingDays,
      reviewDue,
    };
  }

  const reachedTakeProfit =
    takeProfit != null && takeProfit > 0 && currentPrice >= takeProfit;
  const strongProfit = pnlPercent >= 5;
  const profitWithHeat =
    pnlPercent >= 3 &&
    ((rsi != null && rsi >= 72) ||
      (changePercent != null && changePercent <= -1.5) ||
      (aiPower != null && aiPower < 75));

  if (reachedTakeProfit || strongProfit || profitWithHeat) {
    const reasons: string[] = [];
    if (reachedTakeProfit) reasons.push(`利確目安 ${Math.round(takeProfit!)}円に到達`);
    if (pnlPercent > 0) reasons.push(`含み益 ${pnlPercent.toFixed(2)}%`);
    if (rsi != null && rsi >= 72) reasons.push(`RSI ${Math.round(rsi)}で過熱気味`);
    if (changePercent != null && changePercent <= -1.5) reasons.push("当日の勢いが弱まっています");
    if (aiPower != null && aiPower < 75) reasons.push("AI POWERの勢いがやや低下");
    return {
      status: "TAKE_PROFIT_WATCH",
      label: "利確警戒",
      icon: "🟡",
      tone: "amber",
      summary: "利益を守るため、利確ラインと勢いの鈍化を確認する局面です。",
      reasons,
      pnlPercent,
      holdingDays,
      reviewDue,
    };
  }

  const reasons: string[] = [];
  if (aiPower != null && aiPower >= 70) reasons.push(`AI POWER ${Math.round(aiPower)}を維持`);
  if (pnlPercent >= 0) reasons.push(`購入価格比 ${pnlPercent >= 0 ? "+" : ""}${pnlPercent.toFixed(2)}%`);
  if (volumeRatio != null && volumeRatio >= 1) reasons.push("出来高は平常水準以上");
  if (changePercent != null && changePercent >= -1) reasons.push("当日の値動きは大崩れしていません");
  if (reviewDue) reasons.push("設定した追跡期間に到達したため見直しタイミング");

  return {
    status: "HOLD",
    label: "継続保有",
    icon: "🔵",
    tone: "emerald",
    summary: "上昇条件が大きく崩れておらず、継続監視できる状態です。",
    reasons: reasons.length ? reasons : ["現在の条件では撤退・利確警戒の条件に未到達"],
    pnlPercent,
    holdingDays,
    reviewDue,
  };
}


export type SwingEntryDecisionStatus =
  | "CANDIDATE"
  | "WAIT"
  | "WATCH"
  | "AVOID";

export type SwingEntryDecisionInput = {
  aiPower?: number | null;
  rsi?: number | null;
  volumeRatio?: number | null;
  changePercent?: number | null;
};

export type SwingEntryDecision = {
  status: SwingEntryDecisionStatus;
  label: string;
  icon: string;
  tone: "emerald" | "blue" | "amber" | "rose";
  summary: string;
  reasons: string[];
};

export function getSwingEntryDecision(
  input: SwingEntryDecisionInput,
): SwingEntryDecision {
  const aiPower = finiteOrNull(input.aiPower);
  const rsi = finiteOrNull(input.rsi);
  const volumeRatio = finiteOrNull(input.volumeRatio);
  const changePercent = finiteOrNull(input.changePercent);

  const overheated = rsi != null && rsi >= 75;
  const sharpDrop = changePercent != null && changePercent <= -2;

  const reasons: string[] = [];
  if (aiPower != null) reasons.push(`AI POWER ${Math.round(aiPower)}`);

  if (rsi != null) {
    if (overheated) {
      reasons.push(`RSI ${Math.round(rsi)}で過熱気味`);
    } else if (rsi <= 35) {
      reasons.push(`RSI ${Math.round(rsi)}で売られ気味`);
    } else {
      reasons.push(`RSI ${Math.round(rsi)}で過熱感は限定的`);
    }
  }

  if (changePercent != null) {
    if (sharpDrop) {
      reasons.push(`当日変化率 ${changePercent.toFixed(2)}%で勢いに注意`);
    } else if (changePercent > 0) {
      reasons.push(`当日変化率 +${changePercent.toFixed(2)}%`);
    } else {
      reasons.push(`当日変化率 ${changePercent.toFixed(2)}%`);
    }
  }

  if (volumeRatio != null) {
    if (volumeRatio >= 1.1) {
      reasons.push(`出来高 ${volumeRatio.toFixed(1)}倍で増加`);
    } else if (volumeRatio < 0.8) {
      reasons.push(`出来高 ${volumeRatio.toFixed(1)}倍でやや少なめ`);
    }
  }

  if (aiPower == null) {
    return {
      status: "WATCH",
      label: "様子見",
      icon: "🟡",
      tone: "amber",
      summary: "判定材料がまだ十分ではないため、追加シグナルを待つ状態です。",
      reasons: reasons.length ? reasons : ["AI分析データを確認中"],
    };
  }

  if (aiPower >= 85 && !overheated && !sharpDrop) {
    return {
      status: "CANDIDATE",
      label: "スイング候補",
      icon: "🟢",
      tone: "emerald",
      summary: "数日〜2週間の候補として監視しやすい状態です。",
      reasons,
    };
  }

  if (aiPower >= 75) {
    return {
      status: "WAIT",
      label: "押し目待ち",
      icon: "🔵",
      tone: "blue",
      summary:
        overheated || sharpDrop
          ? "条件は悪くありませんが、今すぐ追わず値動きが落ち着くのを待ちたい状態です。"
          : "上昇の兆しはあります。もう一段強いシグナルや押し目を待つ状態です。",
      reasons,
    };
  }

  if (aiPower >= 65) {
    return {
      status: "WATCH",
      label: "様子見",
      icon: "🟡",
      tone: "amber",
      summary: "方向感がまだ弱く、スイングで入る前に追加シグナルを確認したい状態です。",
      reasons,
    };
  }

  return {
    status: "AVOID",
    label: "見送り",
    icon: "🔴",
    tone: "rose",
    summary: "短期の上昇条件が弱く、今は無理にスイング対象にしない寄りの状態です。",
    reasons,
  };
}
