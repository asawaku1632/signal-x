import {
  PRECLOSE_POLICY, statsForPreclose,
  type PrecloseObservation, type PrecloseStats,
} from "./precloseCandidateStudy.ts";

const BANDS = [
  { id: "0-10", label: "10万円以下", minExclusive: 0, maxInclusive: 100_000 },
  { id: "10-30", label: "10万超〜30万円", minExclusive: 100_000, maxInclusive: 300_000 },
  { id: "30-50", label: "30万超〜50万円", minExclusive: 300_000, maxInclusive: 500_000 },
  { id: "50-100", label: "50万超〜100万円", minExclusive: 500_000, maxInclusive: 1_000_000 },
] as const;
export const PRECLOSE_EXCLUSIVE_BANDS = BANDS;
export const PRECLOSE_COMPARE_SLOTS = ["09:15", "09:30", "10:30", "12:40", "13:00", "14:30"] as const;

function validPositive(value: number | null): value is number {
  return value !== null && Number.isFinite(value) && value > 0;
}
function qualifiesAi(value: number | null) {
  return value !== null && Number.isFinite(value) && value >= PRECLOSE_POLICY.minAiPower;
}

export function classifyPreclose100Shares(pricePerShare: number) {
  if (!Number.isFinite(pricePerShare) || pricePerShare <= 0) return null;
  const cost = 100 * pricePerShare;
  return BANDS.find((band) => cost > band.minExclusive && cost <= band.maxInclusive)?.id ?? null;
}

export type ExclusiveBandSummary = {
  id: string;
  label: string;
  todayCount: number;
  stats: PrecloseStats;
  positivePct: number | null;
  worst100: number | null;
};

export function summarizeExclusivePrecloseBands(
  rows: PrecloseObservation[], todayJst: string,
): ExclusiveBandSummary[] {
  const observedToday = rows.filter((r) => r.tradeDate === todayJst
    && validPositive(r.entryPrice) && qualifiesAi(r.aiPower));
  const historical = rows.filter((r) => r.tradeDate < todayJst
    && r.tradeDate < r.outcomeDate && r.outcomeDate <= todayJst
    && validPositive(r.entryPrice) && validPositive(r.outcomePrice)
    && qualifiesAi(r.aiPower));
  return BANDS.map((band) => {
    const todayCount = observedToday.filter((r) => classifyPreclose100Shares(r.entryPrice) === band.id).length;
    const valid = historical.filter((r) => classifyPreclose100Shares(r.entryPrice) === band.id);
    const stats = statsForPreclose(valid);
    const pnl = valid.map((r) => 100 * ((r.outcomePrice as number) - r.entryPrice));
    return {
      id: band.id, label: band.label, todayCount, stats,
      positivePct: pnl.length ? 100 * pnl.filter((x) => x > 0).length / pnl.length : null,
      worst100: pnl.length ? Math.min(...pnl) : null,
    };
  });
}

/** Each row corresponds to the same date+code+next-trading-day reference price at 15:15 and an earlier slot. */
export type PrecloseMatchedTimePair = {
  tradeDate: string;
  code: string;
  slot: string;
  preclosePrice: number;
  earlierPrice: number;
  precloseAi: number | null;
  earlierAi: number | null;
  outcomePrice: number | null;
};
export type MatchedTimeSummary = {
  slot: string;
  matched: number;
  observedDays: number;
  precloseMeanPct: number | null;
  earlierMeanPct: number | null;
  differencePctPoints: number | null;
  precloseWinRate: number | null;
  earlierWinRate: number | null;
};
export type MatchedBandGroup = {
  bandId: string;
  label: string;
  slots: MatchedTimeSummary[];
};

export function compareMatchedTimeByExclusiveBand(
  pairs: PrecloseMatchedTimePair[], todayJst: string,
): MatchedBandGroup[] {
  const aggregates = new Map<string, {
    dates: Set<string>; preclose: number[]; earlier: number[];
  }>();
  for (const p of pairs) {
    if (p.tradeDate >= todayJst || !PRECLOSE_COMPARE_SLOTS.some((slot) => slot === p.slot)
      || !validPositive(p.preclosePrice) || !validPositive(p.earlierPrice)
      || !validPositive(p.outcomePrice) || !qualifiesAi(p.precloseAi) || !qualifiesAi(p.earlierAi)) continue;
    const band = classifyPreclose100Shares(p.preclosePrice);
    if (band === null || band !== classifyPreclose100Shares(p.earlierPrice)) continue;
    const key = band + ":" + p.slot;
    let agg = aggregates.get(key);
    if (!agg) {
      agg = { dates: new Set(), preclose: [], earlier: [] };
      aggregates.set(key, agg);
    }
    agg.dates.add(p.tradeDate);
    agg.preclose.push(100 * (p.outcomePrice - p.preclosePrice) / p.preclosePrice);
    agg.earlier.push(100 * (p.outcomePrice - p.earlierPrice) / p.earlierPrice);
  }
  const average = (list: number[]) => list.length
    ? list.reduce((a, b) => a + b, 0) / list.length : null;
  const winRate = (changes: number[]) => {
    const wins = changes.filter((x) => x >= 2).length;
    const losses = changes.filter((x) => x <= -2).length;
    return wins + losses ? 100 * wins / (wins + losses) : null;
  };
  return BANDS.map((band) => ({
    bandId: band.id,
    label: band.label,
    slots: PRECLOSE_COMPARE_SLOTS.map((slot) => {
      const agg = aggregates.get(band.id + ":" + slot);
      const prior = average(agg?.earlier ?? []);
      const preclose = average(agg?.preclose ?? []);
      return {
        slot,
        matched: agg?.earlier.length ?? 0,
        observedDays: agg?.dates.size ?? 0,
        precloseMeanPct: preclose,
        earlierMeanPct: prior,
        differencePctPoints: preclose === null || prior === null ? null : preclose - prior,
        precloseWinRate: winRate(agg?.preclose ?? []),
        earlierWinRate: winRate(agg?.earlier ?? []),
      };
    }),
  }));
}
