/**
 * Real-trade research calculations. No brokerage connection, quotes or side effects.
 * All amounts are JPY; this module does not estimate execution prices.
 */
export type ClosedTrade = {
  quantity: number;
  buyPrice: number;
  sellPrice: number;
  buyFees?: number;
  sellFees?: number;
  taxes?: number;
};

function nonNegativeFinite(value: number, label: string): void {
  if (!Number.isFinite(value) || value < 0) throw new RangeError(label);
}

export function calculateClosedTrade(trade: ClosedTrade) {
  const { quantity, buyPrice, sellPrice, buyFees = 0, sellFees = 0, taxes = 0 } = trade;
  if (!Number.isSafeInteger(quantity) || quantity <= 0) throw new RangeError("quantity");
  for (const [label, value] of Object.entries({ buyPrice, sellPrice, buyFees, sellFees, taxes })) {
    nonNegativeFinite(value, label);
  }
  const purchaseValue = quantity * buyPrice;
  const saleValue = quantity * sellPrice;
  const grossProfit = saleValue - purchaseValue;
  const netProfit = grossProfit - buyFees - sellFees - taxes;
  const investedAmount = purchaseValue + buyFees;
  return {
    purchaseValue,
    saleValue,
    grossProfit,
    netProfit,
    grossReturnPercent: purchaseValue > 0 ? (grossProfit / purchaseValue) * 100 : null,
    netReturnPercent: investedAmount > 0 ? (netProfit / investedAmount) * 100 : null,
  };
}

/** Hypothetical end-of-day comparison, not a realizable fill or recommendation. */
export function compareWithClose(trade: ClosedTrade, verifiedClose: number | null) {
  if (verifiedClose === null) return null;
  nonNegativeFinite(verifiedClose, "verifiedClose");
  return {
    hypotheticalCloseGrossProfit: (verifiedClose - trade.buyPrice) * trade.quantity,
    differenceFromActualGrossProfit: (verifiedClose - trade.sellPrice) * trade.quantity,
  };
}
