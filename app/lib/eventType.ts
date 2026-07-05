export function detectEventType(stock: any) {
  const reason = String(stock.reason ?? "");
  const patternSignal = String(stock.patternSignal ?? "");
  const candleSignal = String(stock.candleSignal ?? "");

  if (
    reason.includes("決算") ||
    reason.includes("上方修正") ||
    reason.includes("下方修正")
  ) {
    return "EARNINGS";
  }

  if (
    reason.includes("配当") ||
    reason.includes("増配") ||
    reason.includes("自社株買い")
  ) {
    return "SHAREHOLDER_RETURN";
  }

  if (reason.includes("ニュース") || reason.includes("材料")) {
    return "NEWS";
  }

  if (patternSignal !== "NONE" || candleSignal !== "NONE") {
    return "TECHNICAL_EVENT";
  }

  return "NONE";
}