export type NotificationLevel = "HOT" | "STRONG" | "WATCH" | "NO_ACTION";

export type NotificationCandidate = {
  code: string;
  name: string;
  score: number;
  rank?: string;
  price?: number;
  reason?: string;
  takeProfit?: number;
  stopLoss?: number;
  level: NotificationLevel;
};

export type NotificationSummary = {
  enabled: boolean;
  hotCount: number;
  strongCount: number;
  watchCount: number;
  topCandidate: NotificationCandidate | null;
  candidates: NotificationCandidate[];
};

export type ScanResponsePayloadParams = {
  debugVersion: string;
  aiPowerVersion: string;
  cached: boolean;
  limit: number;
  totalStockList?: number;
  stocks: any[];
  marketPattern?: string;
  scanMs?: number;
  batchSize?: number;
  cacheAge?: number;
  fallback?: boolean;
  error?: string;
};

function toNumber(value: unknown, fallback = 0) {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : fallback;
}

export function getNotificationLevel(stock: any): NotificationLevel {
  const score = toNumber(stock?.score ?? stock?.aiPower, 0);

  if (score >= 85) return "HOT";
  if (score >= 70) return "STRONG";
  if (score >= 50) return "WATCH";
  return "NO_ACTION";
}

export function buildNotificationCandidate(stock: any): NotificationCandidate {
  return {
    code: String(stock?.code ?? ""),
    name: String(stock?.name ?? ""),
    score: toNumber(stock?.score ?? stock?.aiPower, 0),
    rank: stock?.rank,
    price: stock?.price,
    reason: stock?.reason,
    takeProfit: stock?.takeProfit,
    stopLoss: stock?.stopLoss,
    level: getNotificationLevel(stock),
  };
}

export function buildNotificationSummary(stocks: any[]): NotificationSummary {
  const candidates = stocks
    .map(buildNotificationCandidate)
    .filter((candidate) => candidate.level !== "NO_ACTION")
    .sort((a, b) => b.score - a.score)
    .slice(0, 20);

  return {
    enabled: true,
    hotCount: candidates.filter((candidate) => candidate.level === "HOT").length,
    strongCount: candidates.filter((candidate) => candidate.level === "STRONG").length,
    watchCount: candidates.filter((candidate) => candidate.level === "WATCH").length,
    topCandidate: candidates[0] ?? null,
    candidates,
  };
}

export function buildScanResponsePayload(params: ScanResponsePayloadParams) {
  const firstStock = params.stocks[0];
  const marketLearning = firstStock?.scoreBreakdown?.marketLearning;
  const timeLearningResult = firstStock?.scoreBreakdown?.timeLearning;

  return {
    success: true,
    cached: params.cached,
    fallback: params.fallback,
    debugVersion: params.debugVersion,
    aiPowerVersion: params.aiPowerVersion,
    learningBonusEnabled: true,
    patternBonusEnabled: true,
    weightRulesEnabled: true,
    sectorEnabled: true,
    sectorBonusEnabled: true,
    sectorWeightRuleEnabled: true,
    experienceBonusEnabled: true,
    similarExperienceEnabled: true,
    experienceRankingEnabled: true,
    aiPipelineEnabled: true,
    stockAnalyzerEnabled: true,
    notificationEngineEnabled: true,
    marketPattern: params.marketPattern,
    marketBonus: marketLearning?.bonus ?? 0,
    marketWinRate: marketLearning?.winRate ?? 0,
    marketConfidence: marketLearning?.confidence ?? 0,
    marketBonusSource: marketLearning?.source ?? "fixed",
    timeBonus: timeLearningResult?.bonus ?? 0,
    cacheAge: params.cacheAge,
    error: params.error,
    count: params.stocks.length,
    requestedLimit: params.limit,
    totalStockList: params.totalStockList,
    scanMs: params.scanMs,
    batchSize: params.batchSize,
    notificationSummary: buildNotificationSummary(params.stocks),
    stocks: params.stocks,
  };
}

export function buildScanErrorPayload(debugVersion: string, error: unknown) {
  return {
    success: false,
    cached: false,
    debugVersion,
    stockAnalyzerEnabled: true,
    notificationEngineEnabled: true,
    stocks: [],
    error: String(error),
  };
}
