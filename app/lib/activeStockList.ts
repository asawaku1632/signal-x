import { STOCKS, type Stock } from "@/app/lib/stockList";
import { VERIFICATION_EXCLUDED_STOCKS } from "@/app/lib/verificationExcludedStocks";

const excludedCodeSet = new Set(
  VERIFICATION_EXCLUDED_STOCKS.map((stock) => String(stock.code))
);

function isoDate(date: Date) {
  return new Date(date.getTime() + 9 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
}

export function isStockActiveOnDate(stock: Stock, asOf = new Date()) {
  const date = isoDate(asOf);
  if (stock.listedFrom && date < stock.listedFrom) return false;
  if (stock.listedUntil && date > stock.listedUntil) return false;

  const status = stock.status ?? "ACTIVE";
  if (status === "ACTIVE") return true;

  return Boolean(stock.listedUntil && date <= stock.listedUntil);
}

export const ACTIVE_STOCKS = STOCKS.filter(
  (stock) =>
    isStockActiveOnDate(stock) &&
    !excludedCodeSet.has(String(stock.code))
);
