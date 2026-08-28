import type { TechnicalTimeframe } from "./types.ts";

export const CONFIRMATION_EVIDENCE_CATEGORIES = [
  "TREND", "MOMENTUM", "VOLUME", "VOLATILITY", "MOVING_AVERAGE", "PATTERN", "MARKET_STRUCTURE",
] as const;

export type ConfirmationEvidenceCategory = (typeof CONFIRMATION_EVIDENCE_CATEGORIES)[number];
export type ConfirmationEvidenceDirection = "BULLISH" | "BEARISH" | "NEUTRAL";
export type EvidenceValues = Readonly<Record<string, number | string | boolean | null>>;

export type ConfirmationEvidence = {
  id: string;
  category: ConfirmationEvidenceCategory;
  name: string;
  direction: ConfirmationEvidenceDirection;
  status: string;
  strength: number;
  confidence: number;
  timeframe: TechnicalTimeframe;
  asOfIndex: number;
  timestamp: number;
  values: EvidenceValues;
  source: string;
  family: string;
  correlationGroup: string;
};

export type EvidenceConflict = { bullishEvidenceId: string; bearishEvidenceId: string; reason: string };
export type EvidenceDuplicateGroup = { family: string; evidenceIds: string[] };
export type EvidenceAssociation = { targetId: string; targetType: "PATTERN" | "BREAKOUT"; evidenceIds: string[] };

export type EvidenceBundle = {
  asOfIndex: number;
  timestamp: number;
  bullish: ConfirmationEvidence[];
  bearish: ConfirmationEvidence[];
  neutral: ConfirmationEvidence[];
  categories: Partial<Record<ConfirmationEvidenceCategory, ConfirmationEvidence[]>>;
  conflicts: EvidenceConflict[];
  duplicateGroups: EvidenceDuplicateGroup[];
  associations: EvidenceAssociation[];
};
