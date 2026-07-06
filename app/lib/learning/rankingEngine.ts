/**
 * SIGNALX V19 Ranking Engine
 * ------------------------------------------------------------
 * Role:
 * - Sort analyzed stocks by score
 * - Classify stocks into HOT / STRONG / WATCH
 * - Extract top candidate
 * - Normalize rank and candidate fields
 *
 * NotificationEngine should only format notification summaries.
 * Route should only call this engine and pass the result forward.
 */

export type RankingLevel = 'HOT' | 'STRONG' | 'WATCH' | 'IGNORE';

export type RankingInputStock = Record<string, any> & {
  code?: string;
  name?: string;
  score?: number;
  aiPower?: number;
  finalScore?: number;
  changePercent?: number;
  price?: number;
  reasons?: string[];
  reason?: string;
};

export type RankedStock = RankingInputStock & {
  rank: number;
  rankingLevel: RankingLevel;
  signalLevel: RankingLevel;
  isHot: boolean;
  isStrong: boolean;
  isWatch: boolean;
};

export type RankingSummary = {
  enabled: true;
  version: 'V19.0';
  total: number;
  hotCount: number;
  strongCount: number;
  watchCount: number;
  ignoreCount: number;
  topCandidate: RankedStock | null;
  candidates: RankedStock[];
  hot: RankedStock[];
  strong: RankedStock[];
  watch: RankedStock[];
  rankedStocks: RankedStock[];
};

export type BuildRankingOptions = {
  /** Returned candidate limit. Default: 20 */
  candidateLimit?: number;
  /** HOT threshold. Default: 85 */
  hotScore?: number;
  /** STRONG threshold. Default: 70 */
  strongScore?: number;
  /** WATCH threshold. Default: 50 */
  watchScore?: number;
};

const DEFAULT_OPTIONS: Required<BuildRankingOptions> = {
  candidateLimit: 20,
  hotScore: 85,
  strongScore: 70,
  watchScore: 50,
};

function toNumber(value: unknown, fallback = 0): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

export function getStockScore(stock: RankingInputStock): number {
  return toNumber(stock.score ?? stock.aiPower ?? stock.finalScore, 0);
}

export function classifyRankingLevel(
  score: number,
  options: Required<BuildRankingOptions> = DEFAULT_OPTIONS
): RankingLevel {
  if (score >= options.hotScore) return 'HOT';
  if (score >= options.strongScore) return 'STRONG';
  if (score >= options.watchScore) return 'WATCH';
  return 'IGNORE';
}

function compareStocks(a: RankingInputStock, b: RankingInputStock): number {
  const scoreDiff = getStockScore(b) - getStockScore(a);
  if (scoreDiff !== 0) return scoreDiff;

  const changeDiff = toNumber(b.changePercent, 0) - toNumber(a.changePercent, 0);
  if (changeDiff !== 0) return changeDiff;

  return String(a.code ?? '').localeCompare(String(b.code ?? ''), 'ja');
}

export function buildRanking(
  stocks: RankingInputStock[],
  options: BuildRankingOptions = {}
): RankingSummary {
  const resolvedOptions: Required<BuildRankingOptions> = {
    ...DEFAULT_OPTIONS,
    ...options,
  };

  const rankedStocks: RankedStock[] = [...(stocks ?? [])]
    .filter(Boolean)
    .sort(compareStocks)
    .map((stock, index) => {
      const score = getStockScore(stock);
      const rankingLevel = classifyRankingLevel(score, resolvedOptions);

      return {
        ...stock,
        score,
        rank: index + 1,
        rankingLevel,
        signalLevel: rankingLevel,
        isHot: rankingLevel === 'HOT',
        isStrong: rankingLevel === 'STRONG',
        isWatch: rankingLevel === 'WATCH',
      };
    });

  const hot = rankedStocks.filter((stock) => stock.rankingLevel === 'HOT');
  const strong = rankedStocks.filter((stock) => stock.rankingLevel === 'STRONG');
  const watch = rankedStocks.filter((stock) => stock.rankingLevel === 'WATCH');
  const ignoreCount = rankedStocks.length - hot.length - strong.length - watch.length;

  const candidates = rankedStocks
    .filter((stock) => stock.rankingLevel !== 'IGNORE')
    .slice(0, resolvedOptions.candidateLimit);

  return {
    enabled: true,
    version: 'V19.0',
    total: rankedStocks.length,
    hotCount: hot.length,
    strongCount: strong.length,
    watchCount: watch.length,
    ignoreCount,
    topCandidate: candidates[0] ?? null,
    candidates,
    hot,
    strong,
    watch,
    rankedStocks,
  };
}

export function pickTopCandidate(stocks: RankingInputStock[]): RankedStock | null {
  return buildRanking(stocks, { candidateLimit: 1 }).topCandidate;
}
