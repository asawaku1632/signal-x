export function getMarketBonus(marketPattern: string) {
  switch (marketPattern) {
    case "SUPER_BULLISH":
      return 5;
    case "BULLISH":
      return 4;
    case "SLIGHTLY_BULLISH":
      return 3;
    case "NEUTRAL":
      return 0;
    case "BEARISH":
      return -3;
    case "CRASH_WARNING":
      return -6;
    default:
      return 0;
  }
}