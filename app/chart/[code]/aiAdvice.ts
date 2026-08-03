export type AdviceInput = {
  currentPrice: number;
  trend: string;
  status: "BREAKOUT" | "NEAR_RESISTANCE" | "NEAR_SUPPORT" | "BETWEEN_LEVELS" | "BREAKDOWN_RISK" | "NO_DATA";
  supportPrice: number | null;
  resistancePrice: number | null;
  breakoutExpectation: number;
  volumeRatio?: number;
  aiPower: number;
  ma20: number | null;
  ema20: number | null;
  stopLoss: number;
};

export type AdviceImportance =
  | "強気"
  | "強気・高値追い注意"
  | "ブレイク期待・出来高確認待ち"
  | "抵抗線接近"
  | "下降中・突破確認待ち"
  | "下落警戒"
  | "様子見";

export function getAIAdviceImportance({
  trend,
  status,
  breakoutExpectation,
  aiPower,
  volumeRatio,
}: Pick<AdviceInput, "trend" | "status" | "breakoutExpectation" | "aiPower" | "volumeRatio">): AdviceImportance {
  const hasStrongBullishSignals =
    trend === "UPTREND" && aiPower >= 80 && breakoutExpectation >= 70;

  if (status === "BREAKDOWN_RISK") return "下落警戒";
  if (
    trend === "DOWNTREND" &&
    (status === "BREAKOUT" || status === "NEAR_RESISTANCE" || breakoutExpectation >= 60)
  ) {
    return "下降中・突破確認待ち";
  }
  if (trend === "DOWNTREND") return "下落警戒";
  if (status === "NEAR_RESISTANCE" && hasStrongBullishSignals) {
    return "強気・高値追い注意";
  }
  if (status === "NEAR_RESISTANCE") return "抵抗線接近";
  if (
    (status === "BREAKOUT" || hasStrongBullishSignals) &&
    (volumeRatio === undefined || volumeRatio < 1.5)
  ) {
    return "ブレイク期待・出来高確認待ち";
  }
  if (status === "BREAKOUT" || hasStrongBullishSignals) return "強気";
  return "様子見";
}

function yen(value: number) {
  return `${Math.round(value).toLocaleString()}円`;
}

export function buildAIAdvice({
  currentPrice,
  trend,
  status,
  supportPrice,
  resistancePrice,
  breakoutExpectation,
  volumeRatio,
  ma20,
  ema20,
  stopLoss,
}: AdviceInput) {
  const items: string[] = [];
  const hasIncreasedVolume =
    typeof volumeRatio === "number" && volumeRatio >= 1.5;

  const isBreakoutWait =
    trend === "DOWNTREND" &&
    status !== "BREAKDOWN_RISK" &&
    (status === "BREAKOUT" || status === "NEAR_RESISTANCE" || breakoutExpectation >= 60);
  const isDownsideWarning =
    status === "BREAKDOWN_RISK" || (trend === "DOWNTREND" && !isBreakoutWait);

  if (isDownsideWarning) {
    if (ma20 !== null && ema20 !== null && currentPrice < ma20 && currentPrice < ema20) {
      items.push("現在値はMA20とEMA20を下回っています。下落リスクに注意してください。");
    } else if (ma20 !== null && currentPrice < ma20) {
      items.push("現在値はMA20を下回っています。反転を確認するまでは慎重に判断してください。");
    } else if (ema20 !== null && currentPrice < ema20) {
      items.push("現在値はEMA20を下回っています。下落の継続に注意してください。");
    } else {
      items.push("下降圧力が強まっています。反転を確認するまでは慎重に判断してください。");
    }
  } else if (status === "BREAKOUT" && resistancePrice !== null) {
    items.push(
      hasIncreasedVolume
        ? `出来高を伴って抵抗線${yen(resistancePrice)}を突破し、上昇が続く可能性があります。`
        : `抵抗線${yen(resistancePrice)}を突破しています。出来高を確認してから判断してください。`,
    );
  } else if (status === "NEAR_RESISTANCE" && resistancePrice !== null) {
    items.push(
      `抵抗線${yen(resistancePrice)}まで残り${yen(Math.max(0, resistancePrice - currentPrice))}です。高値追いに注意してください。`,
    );
  } else if (status === "NEAR_SUPPORT" && supportPrice !== null) {
    items.push(`支持線${yen(supportPrice)}付近のため、反発を確認できればエントリー候補です。`);
  } else if (trend === "UPTREND") {
    items.push("上昇トレンドが続いています。価格が落ち着く押し目を待つのが有効です。");
  } else if (trend === "DOWNTREND") {
    items.push("下降トレンドが続いているため、反転を確認するまでは様子見が安全です。");
  } else {
    items.push("値動きの方向感を確認してから、エントリーを検討してください。");
  }

  if (isDownsideWarning) {
    if (supportPrice !== null) {
      items.push(`支持線${yen(supportPrice)}割れに警戒してください。損切ライン${yen(stopLoss)}への接近にも注意が必要です。`);
    } else {
      items.push(`損切ライン${yen(stopLoss)}への接近に注意してください。`);
    }
  } else if (isBreakoutWait && resistancePrice !== null) {
    items.push(
      `出来高を伴う抵抗線${yen(resistancePrice)}突破を確認してから、エントリーを検討してください。`,
    );
  } else if (isBreakoutWait) {
    items.push("出来高の増加と下降トレンドからの反転を確認してから判断してください。");
  } else if (hasIncreasedVolume) {
    items.push(`出来高は通常の${volumeRatio.toFixed(1)}倍です。値動きに勢いがあります。`);
  } else if (breakoutExpectation >= 60 && resistancePrice !== null) {
    items.push(
      `ブレイク期待度${Math.round(breakoutExpectation)}%。出来高を伴う${yen(resistancePrice)}突破でエントリー候補です。`,
    );
  } else if (breakoutExpectation >= 60) {
    items.push(`ブレイク期待度${Math.round(breakoutExpectation)}%。出来高の増加を確認してから判断してください。`);
  } else if (supportPrice !== null && currentPrice > supportPrice) {
    items.push(`支持線${yen(supportPrice)}まで残り${yen(currentPrice - supportPrice)}です。割れた場合は慎重に判断してください。`);
  } else {
    items.push(`ブレイク期待度${Math.round(breakoutExpectation)}%。勢いが出るまでは無理な追随を避けてください。`);
  }

  return items;
}
