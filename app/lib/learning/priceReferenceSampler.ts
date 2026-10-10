import { getSectorKey, sectorLabelMap } from "../sectorMap.ts";

export const REFERENCE_SAMPLE_ALGORITHM = "baseline_price_strata_hash_v1";
export const MAX_REFERENCE_SAMPLE_SIZE = 5;
export const MAX_SAMPLE_UNIVERSE = 1300;
export const PRICE_SAMPLE_BANDS = [
  "1,000円未満", "1,000〜2,999円", "3,000〜9,999円", "10,000円以上",
] as const;
type PriceBand = (typeof PRICE_SAMPLE_BANDS)[number];
export type SampleInput = { code: string; name: string; price: string | number | null };
export type SampleChoice = { code: string; name: string; baselinePrice: number; priceBand: PriceBand; sector: string };

/** Stable 32-bit hash. Never use subsequent price movements or the daily reference result to rank symbols. */
export function stableSampleHash(input: string): number {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}
export function getSamplePriceBand(value: number): PriceBand {
  if (value < 1_000) return PRICE_SAMPLE_BANDS[0];
  if (value < 3_000) return PRICE_SAMPLE_BANDS[1];
  if (value < 10_000) return PRICE_SAMPLE_BANDS[2];
  return PRICE_SAMPLE_BANDS[3];
}

/**
 * Deterministic stratified suggestion, up to 5 candidates:
 * - no outside requests, no future return or current scan price
 * - excluded = this trade date's already-observed securities
 * - aim for diversity in baseline-price bands and known sector labels
 * - choice changes by trade date; repeating the same request stays reproducible
 * Not a probability sample, and not an unbiased estimator of the whole market.
 */
export function chooseReferenceSample(
  tradeDate: string,
  source: readonly SampleInput[],
  observedCodes: ReadonlySet<string> = new Set(),
  limit = MAX_REFERENCE_SAMPLE_SIZE,
) {
  if (!/^20\d\d-\d\d-\d\d$/.test(tradeDate)) throw new Error("INVALID_SAMPLE_DATE");
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_REFERENCE_SAMPLE_SIZE) throw new Error("INVALID_SAMPLE_LIMIT");
  const seen = new Set<string>();
  const eligible: (SampleChoice & { hash: number })[] = [];
  for (const row of source) {
    if (!/^\d{4}$/.test(row.code) || seen.has(row.code)) continue;
    seen.add(row.code);
    const baselinePrice = row.price == null ? NaN : Number(row.price);
    if (!Number.isFinite(baselinePrice) || baselinePrice <= 0 || observedCodes.has(row.code)) continue;
    const key = getSectorKey(row.code);
    eligible.push({
      code: row.code, name: row.name, baselinePrice,
      priceBand: getSamplePriceBand(baselinePrice),
      sector: key === "OTHER" ? "その他・未分類" : sectorLabelMap[key],
      hash: stableSampleHash(REFERENCE_SAMPLE_ALGORITHM + ":" + tradeDate + ":" + row.code),
    });
  }
  const byBand = new Map<PriceBand, typeof eligible>();
  for (const band of PRICE_SAMPLE_BANDS) byBand.set(band, []);
  for (const entry of eligible) byBand.get(entry.priceBand)?.push(entry);
  for (const list of byBand.values()) list.sort((a, b) => a.hash - b.hash || a.code.localeCompare(b.code));

  const selected: typeof eligible = [];
  const sectorCount = new Map<string, number>();
  const bandCount = new Map<PriceBand, number>();
  // Starting band is rotated by trading date, and remaining bands get a first opportunity.
  const firstBandIndex = stableSampleHash(tradeDate) % PRICE_SAMPLE_BANDS.length;
  const rotation = [...PRICE_SAMPLE_BANDS.slice(firstBandIndex), ...PRICE_SAMPLE_BANDS.slice(0, firstBandIndex)];
  while (selected.length < limit) {
    const possible = rotation.filter((band) => (byBand.get(band)?.length ?? 0) > 0);
    if (!possible.length) break;
    const minBand = Math.min(...possible.map((band) => bandCount.get(band) ?? 0));
    const targetBand = possible.find((band) => (bandCount.get(band) ?? 0) === minBand)!;
    const candidates = byBand.get(targetBand)!;
    // Within a band, prefer a not-yet-selected known sector; then break ties by stable hash.
    const bestSectorUse = Math.min(...candidates.map((value) => sectorCount.get(value.sector) ?? 0));
    const candidateIndex = candidates.findIndex((value) => (sectorCount.get(value.sector) ?? 0) === bestSectorUse);
    const [picked] = candidates.splice(candidateIndex, 1);
    selected.push(picked);
    sectorCount.set(picked.sector, (sectorCount.get(picked.sector) ?? 0) + 1);
    bandCount.set(picked.priceBand, (bandCount.get(picked.priceBand) ?? 0) + 1);
  }
  return {
    algorithmVersion: REFERENCE_SAMPLE_ALGORITHM,
    eligibleCount: eligible.length,
    excludedAlreadyObserved: [...new Set(source.map((x) => x.code))].filter((code) => observedCodes.has(code)).length,
    choices: selected.map(({ hash: _hash, ...item }) => item),
  };
}
