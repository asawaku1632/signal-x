import { STOCKS } from "@/app/lib/stockList";
import { VERIFICATION_EXCLUDED_STOCKS } from "@/app/lib/verificationExcludedStocks";

const excludedCodeSet = new Set(
  VERIFICATION_EXCLUDED_STOCKS.map((stock) => String(stock.code))
);

export const ACTIVE_STOCKS = STOCKS.filter(
  (stock) => !excludedCodeSet.has(String(stock.code))
);