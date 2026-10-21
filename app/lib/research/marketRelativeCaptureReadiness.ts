export type CaptureReadiness = {
  approved: boolean;
  trustedServerClock: boolean;
  originalSignalTimestamp: boolean;
  immutableSignalId: boolean;
  sourceProvenanceVerified: boolean;
  providerRightsVerified: boolean;
  marketDataFreshnessVerified: boolean;
  developmentReplayVerified: boolean;
  productionChangeApproved: boolean;
};

export function evaluateCaptureReadiness(state: CaptureReadiness): {
  ready: boolean;
  missing: string[];
} {
  const required = [
    "approved", "trustedServerClock", "originalSignalTimestamp",
    "immutableSignalId", "sourceProvenanceVerified",
    "providerRightsVerified", "marketDataFreshnessVerified",
    "developmentReplayVerified", "productionChangeApproved",
  ] as const;
  const missing = required.filter(key => state[key] !== true);
  return { ready: missing.length === 0, missing };
}
