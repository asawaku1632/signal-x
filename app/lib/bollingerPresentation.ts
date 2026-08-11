import type {
  BandWalkRisk,
  BollingerSide,
  BollingerSignal,
  BollingerStatus,
  UpperBollingerRegime,
} from "@/app/lib/bollingerBands";

export function isVisibleBollingerSignal(
  signal?: BollingerSignal,
): signal is BollingerSignal {
  return Boolean(signal && signal.side !== "NONE" && signal.status !== "NONE");
}

export function getBollingerTitle(
  side: BollingerSide,
  upperRegime?: UpperBollingerRegime,
) {
  if (side === "LOWER_REBOUND") return "BB反発候補";
  if (upperRegime === "UPPER_TREND") return "上側BB推移";
  if (upperRegime === "UPPER_REVERSAL") return "BB失速警戒";
  if (side === "UPPER_OVERHEAT") return "上側BB注目";
  return "";
}

export function getBollingerStatusLabel(
  side: BollingerSide,
  status: BollingerStatus,
) {
  if (side === "LOWER_REBOUND") {
    if (status === "NEAR") return "−2σ接近";
    if (status === "TOUCHED") return "−2σ到達";
    if (status === "BREACHED") return "−2σ割れ";
    if (status === "CONFIRMED") return "−2σから反発確認";
  }
  if (side === "UPPER_OVERHEAT") {
    if (status === "NEAR") return "＋2σ接近";
    if (status === "TOUCHED") return "＋2σ到達";
    if (status === "BREACHED") return "＋2σ突破";
    if (status === "CONFIRMED") return "＋2σから失速確認";
  }
  return "";
}

export function getBollingerExpectationLabel(
  side: BollingerSide,
  upperRegime?: UpperBollingerRegime,
) {
  if (side !== "UPPER_OVERHEAT") return "反発期待度";
  return upperRegime === "UPPER_REVERSAL" ? "過熱警戒度" : "上側BB注目度";
}

export function getExpectationLevel(expectation: number) {
  if (expectation >= 80) return "強い";
  if (expectation >= 60) return "注目";
  if (expectation >= 40) return "やや注目";
  return "弱い";
}

export function getBandWalkRiskLabel(risk: BandWalkRisk) {
  if (risk === "HIGH") return "高";
  if (risk === "MEDIUM") return "中";
  return "低";
}

export function buildBollingerComment(signal: BollingerSignal) {
  if (signal.side === "LOWER_REBOUND") {
    if (signal.bandWalkRisk === "HIGH") {
      return "株価は日足ボリンジャーバンド−2σ付近ですが、下降トレンドが続いています。バンドウォークの可能性があるため、反発確認までは慎重に見たい局面です。";
    }
    if (signal.confirmations.length >= 2) {
      return "株価が日足ボリンジャーバンド−2σ付近まで下落しています。日足の複数指標に改善が見られ、短期反発の条件が整いつつあります。";
    }
    return "株価が日足ボリンジャーバンド−2σ付近まで下落しています。短期反発の候補として注目できます。";
  }
  if (signal.side === "UPPER_OVERHEAT") {
    if (signal.upperRegime === "UPPER_TREND") {
      return "株価は日足ボリンジャーバンド＋2σ付近を推移しています。上昇基調が続いており、直ちに下落を示すものではありません。値動きの継続性を観察したい局面です。";
    }
    if (signal.upperRegime === "UPPER_REVERSAL") {
      return "株価が日足ボリンジャーバンド＋2σ付近まで上昇しています。日足の複数指標にも過熱の兆候があり、短期的な値動きに注意したい局面です。";
    }
    return "株価が日足ボリンジャーバンド＋2σ付近にあります。現時点では明確な失速確認ではないため、上側バンド付近の値動きを観察したい局面です。";
  }
  return "";
}
