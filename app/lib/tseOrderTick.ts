/**
 * Conservative Tokyo Stock Exchange price step for cash-equity limit references.
 *
 * Uses the "other issues" (coarser) JPX table. Prices rounded to these whole-yen
 * steps are valid under the finer TOPIX500 table too, without guessing an issue's
 * index membership. This is a REFERENCE DISPLAY helper, not broker validation.
 *
 * JPX announced a tick-regime change for 2027-03-01: review this table before
 * that date. Other venues, instrument-specific rules and broker checks may vary.
 * https://www.jpx.co.jp/equities/trading/domestic/07.html
 */
const TSE_STANDARD_TIERS = [
  { upToYen: 3_000, tickYen: 1 },
  { upToYen: 5_000, tickYen: 5 },
  { upToYen: 30_000, tickYen: 10 },
  { upToYen: 50_000, tickYen: 50 },
  { upToYen: 300_000, tickYen: 100 },
  { upToYen: 500_000, tickYen: 500 },
  { upToYen: 3_000_000, tickYen: 1_000 },
  { upToYen: 5_000_000, tickYen: 5_000 },
  { upToYen: 30_000_000, tickYen: 10_000 },
  { upToYen: 50_000_000, tickYen: 50_000 },
  { upToYen: Number.POSITIVE_INFINITY, tickYen: 100_000 },
] as const;

export function roundDownToTseOrderTick(
  upperLimitYen: number,
): { priceYen: number; tickYen: number } | null {
  if (!Number.isFinite(upperLimitYen) || upperLimitYen < 1) return null;
  const upper = Math.floor(upperLimitYen);
  const tier = TSE_STANDARD_TIERS.find(({ upToYen }) => upper <= upToYen);
  if (!tier) return null;
  const priceYen = Math.floor(upper / tier.tickYen) * tier.tickYen;
  return priceYen > 0 ? { priceYen, tickYen: tier.tickYen } : null;
}
