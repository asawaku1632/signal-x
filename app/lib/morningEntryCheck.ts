import type { OvernightBuyLimit } from "./overnightBuyLimit";

/**
 * Read-only next-session entry safety checks.
 * Deliberately does not return BUY / recommended shares / order instructions.
 * A green-looking AI score is never sufficient to issue a trading instruction.
 */
export type IntradayCandle = {
  time: number;
  open: number;
  close: number;
};

export type MorningEntryCheck = {
  status: "UNAVAILABLE" | "AVOID" | "WATCH" | "CONDITIONAL";
  label: string;
  summary: string;
  reasons: string[];
  referenceClose: number | null;
  limitYen: number | null;
  openingPrice: number | null;
  observedPrice: number | null;
  observedAt: string | null;
};

export type MorningEntryInput = {
  reference: OvernightBuyLimit;
  candles: IntradayCandle[];
  chartStatus: string | null;
  chartUpdatedAt: string | null;
  scanStatus: string | null;
  scanUpdatedAt: string | null;
  aiPower: number | null;
  rsi: number | null;
  scanPrice: number | null;
  now?: Date;
};

const MAX_SNAPSHOT_AGE_MS = 3 * 60_000;
const MAX_CANDLE_AGE_MS = 15 * 60_000;

function tokyoParts(date: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Tokyo", hourCycle: "h23",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", weekday: "short",
  }).formatToParts(date);
  const get = (key: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === key)?.value ?? "";
  return {
    date: `${get("year")}-${get("month")}-${get("day")}`,
    minutes: Number(get("hour")) * 60 + Number(get("minute")),
    weekday: get("weekday"),
  };
}

function isRecentIso(timestamp: string | null, now: Date) {
  if (!timestamp) return false;
  const parsed = Date.parse(timestamp);
  const age = now.getTime() - parsed;
  return Number.isFinite(parsed) && age >= -30_000 && age <= MAX_SNAPSHOT_AGE_MS;
}

function missing(message: string): MorningEntryCheck {
  return {
    status: "UNAVAILABLE", label: "確認待ち", summary: message, reasons: [],
    referenceClose: null, limitYen: null, openingPrice: null,
    observedPrice: null, observedAt: null,
  };
}

export function assessMorningEntry(input: MorningEntryInput): MorningEntryCheck {
  const now = input.now ?? new Date();
  const clock = tokyoParts(now);
  const minutes = clock.minutes;
  if (clock.weekday === "Sat" || clock.weekday === "Sun" ||
    !((minutes >= 9 * 60 + 5 && minutes <= 11 * 60 + 30) ||
      (minutes >= 12 * 60 + 35 && minutes <= 15 * 60 + 30))) {
    return missing("取引開始直後・昼休み・取引時間外は、安全な再判定を保留します。");
  }
  if (input.reference.status !== "ready" ||
    input.reference.referenceDate >= clock.date) {
    return missing("前営業日の終値と統計的な上限を確認できません。");
  }
  // API response freshness alone cannot prove that the market candle is current.
  if (input.chartStatus !== "fresh" || !isRecentIso(input.chartUpdatedAt, now)) {
    return missing("チャートの更新を確認できません。古い値段で判定しません。");
  }
  if (input.scanStatus !== "fresh" || !isRecentIso(input.scanUpdatedAt, now)) {
    return missing("AI分析の更新を確認できません。AI POWERを再取得してから判断してください。");
  }
  const ai = input.aiPower;
  if (ai === null || !Number.isFinite(ai) || ai < 0 || ai > 100) {
    return missing("AI POWERの値を確認できません。");
  }
  if (!Array.isArray(input.candles)) {
    return missing("当日の値動きデータを取得できません。");
  }
  const intraday = input.candles.filter((candle) => {
    if (!candle || !Number.isFinite(candle.time) ||
      !Number.isFinite(candle.open) || !Number.isFinite(candle.close) ||
      candle.open <= 0 || candle.close <= 0) return false;
    const local = tokyoParts(new Date(candle.time * 1000));
    return local.date === clock.date && local.minutes >= 9 * 60 &&
      local.minutes <= 15 * 60 + 30;
  }).sort((a, b) => a.time - b.time);
  if (!intraday.length) return missing("本日の5分足がまだありません。");
  const first = intraday[0];
  const latest = intraday[intraday.length - 1];
  const quoteAge = now.getTime() - latest.time * 1000;
  if (quoteAge < -30_000 || quoteAge > MAX_CANDLE_AGE_MS) {
    return missing("直近の株価データが古いため、売買判断を保留します。");
  }
  const observedPrice = latest.close;
  const openingPrice = first.open;
  const ref = input.reference;
  const common = {
    referenceClose: ref.referenceClose,
    limitYen: ref.limitYen,
    openingPrice,
    observedPrice,
    observedAt: new Date(latest.time * 1000).toISOString(),
  };
  const scanPrice = input.scanPrice;
  if (scanPrice === null || !Number.isFinite(scanPrice) || scanPrice <= 0) {
    return { ...common, status: "UNAVAILABLE", label: "確認待ち",
      summary: "AI分析で使われた株価が不明です。", reasons: [] };
  }
  const priceDisagreement = Math.abs(scanPrice / observedPrice - 1);
  if (priceDisagreement > 0.003) {
    return { ...common, status: "UNAVAILABLE", label: "価格の食い違い",
      summary: "AI評価とチャートの価格に差があります。同時点の情報として扱いません。",
      reasons: [`AI評価側の株価と5分足の差が${(priceDisagreement * 100).toFixed(2)}%`] };
  }

  const warnings: string[] = [];
  if (observedPrice > ref.limitYen) {
    warnings.push("現在値が夜に計算した参考上限を超えています");
  }
  if (openingPrice > ref.limitYen) {
    warnings.push("寄り付き価格が参考上限より高く始まりました");
  }
  if (ai < 75) warnings.push(`AI POWERが${ai.toFixed(1)}で、買い候補の強さが不足`);
  if (observedPrice <= openingPrice * 0.99) {
    warnings.push("寄り付きから1%以上下落しています");
  }
  if (observedPrice <= ref.referenceClose * 0.98) {
    warnings.push("前営業日終値から2%以上下落しています");
  }
  if (warnings.length) {
    return { ...common, status: "AVOID", label: "新規購入を見送り寄り",
      summary: "値段やAI評価に警戒条件があります。高値を追いかけるより再確認を優先してください。",
      reasons: warnings };
  }

  if (input.rsi === null || !Number.isFinite(input.rsi) ||
    input.rsi < 0 || input.rsi > 100) {
    return { ...common, status: "WATCH", label: "追加確認が必要",
      summary: "RSIが不明なため、短期的な過熱を評価できません。",
      reasons: ["チャートと証券会社で最新情報を確認してください"] };
  }

  const caution: string[] = [];
  if (ai < 85) caution.push(`AI POWER ${ai.toFixed(1)}：強い候補条件に届いていません`);
  if (input.rsi >= 75) caution.push(`RSI ${input.rsi.toFixed(0)}：過熱気味`);
  if (observedPrice < openingPrice) caution.push("寄り付きの値段を下回っています");
  if (caution.length) {
    return { ...common, status: "WATCH", label: "追加確認が必要",
      summary: "参考上限内でも、強い買い条件がそろっていません。", reasons: caution };
  }
  return {
    ...common, status: "CONDITIONAL", label: "参考条件内・最終確認",
    summary: "今回の確認条件は満たしています。ただし買い推奨ではありません。証券会社の板・価格・リスクを確認してください。",
    reasons: [`AI POWER ${ai.toFixed(1)}`, `RSI ${input.rsi.toFixed(0)}`,
      "最新5分足は参考上限以下です"],
  };
}
