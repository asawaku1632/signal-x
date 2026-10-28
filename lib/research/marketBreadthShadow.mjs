// Research-only, fail-closed market breadth classification. No trading or notification integration.
export function classifyMarketBreadth(input) {
  const {tradeDate, observedAt, source, licenseVerified, nikkeiChangePct, topixChangePct, advancers, decliners, unchanged = 0} = input ?? {};
  if (!/^\d{4}-\d{2}-\d{2}$/.test(tradeDate ?? "") || !Number.isFinite(Date.parse(observedAt ?? "")) ||
      typeof source !== "string" || !source.trim() || licenseVerified !== true ||
      ![nikkeiChangePct, topixChangePct, advancers, decliners, unchanged].every(Number.isFinite) ||
      ![advancers, decliners, unchanged].every(n => Number.isInteger(n) && n >= 0) ||
      advancers + decliners + unchanged === 0 ||
      observedAt.slice(0,10) !== tradeDate) {
    return {status: "UNAVAILABLE", reason: "UNVERIFIED_OR_INCOMPLETE_INPUT", researchOnly: true};
  }
  const total = advancers + decliners + unchanged;
  const advanceRatio = advancers / total;
  const declineRatio = decliners / total;
  const divergence = nikkeiChangePct > 0 && topixChangePct <= 0 && declineRatio >= 0.6;
  return {
    status: divergence ? "INDEX_BREADTH_DIVERGENCE" : "OBSERVED",
    researchOnly: true, tradeDate, observedAt, source,
    advanceRatio, declineRatio, total,
    nikkeiChangePct, topixChangePct,
    ruleVersion: "market-breadth-shadow-v1",
  };
}
