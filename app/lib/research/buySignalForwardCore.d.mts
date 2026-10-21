export declare const RESEARCH_HORIZONS: readonly [1, 3, 5, 10, 20];
export type ForwardObservation = {
  tradeDate: string;
  close: number | null;
  low?: number | null;
  high?: number | null;
  verified?: boolean;
  corporateActionAdjusted?: boolean;
};
export type ForwardOutcome = {
  horizon: number;
  targetDate: string | null;
  status: "CALENDAR_UNAVAILABLE" | "PENDING_OR_MISSING" | "UNVERIFIED" | "VERIFIED";
  returnPct: number | null;
  recoveredToSignal: boolean | null;
};
export declare function evaluateBuySignalForward(input: {
  signalPrice: number;
  signalPriceVerified?: boolean;
  signalPriceCorporateActionAdjusted?: boolean;
  signalDate: string;
  tradingDates: string[];
  observations: ForwardObservation[];
}): {
  outcomes: ForwardOutcome[];
  worstCloseDrawdownPct: number | null;
  firstCloseRecoverySession: number | null;
  caveat: string;
};
