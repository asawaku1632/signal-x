/** Type contract for the research-only point-in-time replay module. */
export type NecklineDailyBar = {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
};
export type NecklineStats = {
  n: number;
  averagePercent: number;
  winRatePercent: number;
};
export type NecklineEvent = {
  first: number;
  second: number;
  low1: number;
  low2: number;
  neckline: number;
  firstSeenIndex: number;
  breakoutIndex: number | null;
  status: "WATCH" | "BREAKOUT" | "INVALIDATED" | "EXPIRED";
  breakoutVolumeRatio: number | null;
  firstSeenDate: string;
  low1Date: string;
  low2Date: string;
  breakoutDate: string | null;
  leadSessions: number | null;
  earlyReturn3: number | null;
  earlyReturn5: number | null;
  breakoutReturn3: number | null;
  breakoutReturn5: number | null;
};
export type NecklineStudy = {
  dataValid: boolean;
  events: NecklineEvent[];
  latest: NecklineEvent | null;
  totalCandidates: number;
  totalBreakouts: number;
  leadSevenCount: number;
  early3: NecklineStats | null;
  early5: NecklineStats | null;
  breakout3: NecklineStats | null;
  breakout5: NecklineStats | null;
  pairedSevenEarly5: NecklineStats | null;
  pairedSevenBreakout5: NecklineStats | null;
};
export function analyzeNecklineTimeline(
  source: readonly NecklineDailyBar[],
  roundTripCostPercent?: number
): NecklineStudy;
