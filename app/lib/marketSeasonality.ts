export type MarketSeasonalityAction = "BUY" | "WAIT" | "SELL";
export type MarketSeasonalityPhase = "仕込み期" | "調整期" | "反発期" | "収穫期";

export type MarketSeasonality = {
  key: string;
  month: number;
  monthLabel: string;
  phase: MarketSeasonalityPhase;
  action: MarketSeasonalityAction;
  scoreImpact: number;
  note: string;
  caution: string;
};

type SeasonalityDefinition = Omit<
  MarketSeasonality,
  "key" | "month" | "monthLabel" | "caution"
>;

const MONTHLY_SEASONALITY: Record<number, SeasonalityDefinition> = {
  1: { phase: "仕込み期", action: "BUY", scoreImpact: 2, note: "年始の仕込み期" },
  2: { phase: "仕込み期", action: "WAIT", scoreImpact: 0, note: "方向感が出にくい時期" },
  3: { phase: "仕込み期", action: "SELL", scoreImpact: -2, note: "決算期で上値が重くなりやすい時期" },
  4: { phase: "調整期", action: "BUY", scoreImpact: 2, note: "新年度の資金流入を意識する時期" },
  5: { phase: "調整期", action: "WAIT", scoreImpact: 0, note: "天井形成と調整に注意する時期" },
  6: { phase: "調整期", action: "SELL", scoreImpact: -2, note: "戻り売りを警戒する時期" },
  7: { phase: "反発期", action: "SELL", scoreImpact: -2, note: "夏枯れによる流動性低下を警戒する時期" },
  8: { phase: "反発期", action: "BUY", scoreImpact: 2, note: "夏の底値反発を意識する時期" },
  9: { phase: "反発期", action: "BUY", scoreImpact: 2, note: "トレンド転換を探る時期" },
  10: { phase: "収穫期", action: "SELL", scoreImpact: -2, note: "利確売りを警戒する時期" },
  11: { phase: "収穫期", action: "BUY", scoreImpact: 2, note: "年末に向けた仕込みを意識する時期" },
  12: { phase: "収穫期", action: "SELL", scoreImpact: -2, note: "年末の利益確定売りを警戒する時期" },
};

function toDate(input: Date | number) {
  if (input instanceof Date) return input;
  const milliseconds = Math.abs(input) < 100_000_000_000 ? input * 1000 : input;
  return new Date(milliseconds);
}

export function getJstMonth(input: Date | number = new Date()) {
  const date = toDate(input);
  if (Number.isNaN(date.getTime())) return new Date().getMonth() + 1;

  return Number(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Tokyo",
      month: "numeric",
    }).format(date),
  );
}

export function getMarketSeasonality(
  input: Date | number = new Date(),
): MarketSeasonality {
  const month = getJstMonth(input);
  const definition = MONTHLY_SEASONALITY[month] ?? MONTHLY_SEASONALITY[1];

  return {
    key: `MONTH_${String(month).padStart(2, "0")}_${definition.action}`,
    month,
    monthLabel: `${month}月`,
    ...definition,
    caution:
      "月別アノマリーは参考情報です。実際の価格・出来高・テクニカル判定を優先します。",
  };
}
