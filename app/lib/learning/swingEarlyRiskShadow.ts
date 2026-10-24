import { getSwingDecision, type SwingDecisionInput } from "@/app/lib/swingDecision";

// SHADOW / RESEARCH ONLY. No orders, notifications, model weights or writes.
// Feed only historically available snapshots ordered by capture time.
export type SwingRiskObservation = {
  observedAt: string;
  price: number;
  aiPower: number | null;
  changePercent?: number | null;
  rsi?: number | null;
  volumeRatio?: number | null;
  stopLoss?: number | null;
};

export type SwingRiskCheckpoint = {
  observedAt: string;
  price: number;
  pnlPercent: number;
  aiPower: number | null;
  earlyRisk: boolean;
  reasons: string[];
  productionExit: boolean;
};

function validTime(value: string): number | null {
  const time = Date.parse(value);
  return Number.isFinite(time) ? time : null;
}

/** Evaluate an existing simulated position, without retroactive data or trading actions. */
export function evaluateSwingEarlyRiskShadow(input: {
  entryPrice: number;
  startedAt: string;
  trackingDays?: number | null;
  observations: readonly SwingRiskObservation[];
}): {
  checkpoints: SwingRiskCheckpoint[];
  firstEarlyRisk: SwingRiskCheckpoint | null;
  firstProductionExit: SwingRiskCheckpoint | null;
  leadTimeHours: number | null;
  skipped: number;
} {
  const started = validTime(input.startedAt);
  if (!Number.isFinite(input.entryPrice) || input.entryPrice <= 0 || started === null) {
    return { checkpoints: [], firstEarlyRisk: null, firstProductionExit: null, leadTimeHours: null, skipped: input.observations.length };
  }

  const unique = new Map<number, SwingRiskObservation>();
  let skipped = 0;
  for (const observation of input.observations) {
    const time = validTime(observation.observedAt);
    if (time === null || time < started || !Number.isFinite(observation.price) ||
        observation.price <= 0 || (observation.aiPower !== null &&
        (!Number.isFinite(observation.aiPower) || observation.aiPower < 0 || observation.aiPower > 100))) {
      skipped += 1;
      continue;
    }
    // Duplicate timestamps cannot safely be ordered: exclude both.
    if (unique.has(time)) {
      unique.delete(time);
      skipped += 2;
    } else {
      unique.set(time, observation);
    }
  }

  const checkpoints: SwingRiskCheckpoint[] = [...unique.entries()]
    .sort(([a], [b]) => a - b)
    .map(([, observation]) => {
      const pnlPercent = (observation.price / input.entryPrice - 1) * 100;
      const reasons: string[] = [];
      // Experimental thresholds, NOT a validated or deployable trading rule.
      if (pnlPercent <= -1.5) reasons.push("購入価格から-1.5%以下（研究閾値）");
      if (observation.aiPower !== null && observation.aiPower < 70) reasons.push("AI POWER 70未満（研究閾値）");
      const decisionInput: SwingDecisionInput = {
        currentPrice: observation.price,
        entryPrice: input.entryPrice,
        startedAt: input.startedAt,
        trackingDays: input.trackingDays,
        aiPower: observation.aiPower,
        changePercent: observation.changePercent,
        rsi: observation.rsi,
        volumeRatio: observation.volumeRatio,
        stopLoss: observation.stopLoss,
      };
      return {
        observedAt: observation.observedAt,
        price: observation.price,
        pnlPercent,
        aiPower: observation.aiPower,
        earlyRisk: reasons.length > 0,
        reasons,
        // Null AI POWER is allowed for price-triggered exit only; do not fill from a later scan.
        productionExit: getSwingDecision(decisionInput).status === "EXIT",
      };
    });
  const firstEarlyRisk = checkpoints.find((checkpoint) => checkpoint.earlyRisk) ?? null;
  const firstProductionExit = checkpoints.find((checkpoint) => checkpoint.productionExit) ?? null;
  const earlyAt = firstEarlyRisk ? validTime(firstEarlyRisk.observedAt) : null;
  const exitAt = firstProductionExit ? validTime(firstProductionExit.observedAt) : null;
  const leadTimeHours = earlyAt !== null && exitAt !== null && earlyAt < exitAt
    ? (exitAt - earlyAt) / 3_600_000 : null;
  return { checkpoints, firstEarlyRisk, firstProductionExit, leadTimeHours, skipped };
}
