/**
 * Read-only scenario calculator. No orders, persistence, quotes or trading signals.
 * All prices are per share, quantities are whole shares. Fees and taxes are excluded.
 */
export type NanpinInput = {
  entryPrice: number;
  heldShares: number;
  addPrice: number;
  addShares: number;
  futurePrice: number;
};
export type NanpinComparison = {
  beforeYen: number;
  afterYen: number;
  differenceYen: number;
  beforePercent: number;
  afterPercent: number;
};
export type NanpinScenario = {
  initialCost: number;
  additionalCost: number;
  totalCost: number;
  totalShares: number;
  averagePrice: number;
  lowerBreakEvenBy: number;
  selected: NanpinComparison;
  downTenPercentPrice: number;
  downTenPercent: NanpinComparison;
};

export function compareNanpinAtPrice(input: NanpinInput, price: number): NanpinComparison {
  const initialCost = input.entryPrice * input.heldShares;
  const additionalCost = input.addPrice * input.addShares;
  const beforeYen = (price - input.entryPrice) * input.heldShares;
  const afterYen = price * (input.heldShares + input.addShares) - (initialCost + additionalCost);
  return {
    beforeYen,
    afterYen,
    differenceYen: afterYen - beforeYen,
    beforePercent: beforeYen / initialCost * 100,
    afterPercent: afterYen / (initialCost + additionalCost) * 100,
  };
}

export function calculateNanpin(input: NanpinInput): NanpinScenario | null {
  const { entryPrice, heldShares, addPrice, addShares, futurePrice } = input;
  if (![entryPrice, heldShares, addPrice, addShares, futurePrice].every(Number.isFinite)) return null;
  if (entryPrice <= 0 || heldShares <= 0 || addPrice <= 0 || addShares <= 0 || futurePrice < 0) return null;
  if (!Number.isSafeInteger(heldShares) || !Number.isSafeInteger(addShares)) return null;
  const initialCost = entryPrice * heldShares;
  const additionalCost = addPrice * addShares;
  const totalCost = initialCost + additionalCost;
  const totalShares = heldShares + addShares;
  if (![initialCost, additionalCost, totalCost, totalShares].every(Number.isFinite) || totalCost <= 0) return null;
  const averagePrice = totalCost / totalShares;
  const downTenPercentPrice = Math.round(addPrice * 0.9 * 100) / 100;
  return {
    initialCost,
    additionalCost,
    totalCost,
    totalShares,
    averagePrice,
    lowerBreakEvenBy: entryPrice - averagePrice,
    selected: compareNanpinAtPrice(input, futurePrice),
    downTenPercentPrice,
    downTenPercent: compareNanpinAtPrice(input, downTenPercentPrice),
  };
}
