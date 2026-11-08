/**
 * SHADOW / REPLAY ONLY.
 * The five candidate characteristics are fixed BEFORE examining outcomes.
 * All values are calculated as of firstSeenIndex (the first day when two
 * additional completed daily bars make the second pivot observable).
 * No post-breakout volume, later close, future max/min or hindsight labels
 * can enter a feature or change its bucket.
 */
export const NECKLINE_FEATURE_VERSION = "NECKLINE_ASOF_FIXED_BINS_V1";
export const NECKLINE_MIN_EXPLORATORY_EVENTS = 20;
export const NECKLINE_MIN_INDEPENDENT_SYMBOLS = 10;

export const NECKLINE_FEATURE_AXES = [
  {
    id: "bottomGap",
    title: "① 2つの底の間隔",
    description: "底①から底②までの営業日数",
    bins: [
      { id: "NEAR", label: "4〜12営業日", match: v => v <= 12 },
      { id: "FAR", label: "13〜40営業日", match: v => v > 12 },
    ],
  },
  {
    id: "lowDifferencePercent",
    title: "② 底①と底②の価格差",
    description: "2つの安値の差を高い方の安値で割った割合",
    bins: [
      { id: "SIMILAR", label: "1.5%以内", match: v => v <= 1.5 },
      { id: "DIFFERENT", label: "1.5%超", match: v => v > 1.5 },
    ],
  },
  {
    id: "heightPercent",
    title: "③ ネックラインの高さ",
    description: "高い方の安値からネックラインまでの上昇幅",
    bins: [
      { id: "SHALLOW", label: "10%以内", match: v => v <= 10 },
      { id: "HIGH", label: "10%超", match: v => v > 10 },
    ],
  },
  {
    id: "necklineDistancePercent",
    title: "④ 初検出時のネックラインまでの距離",
    description: "初検出日の終値からネックラインまでの距離",
    bins: [
      { id: "CLOSE", label: "5%以内", match: v => v <= 5 },
      { id: "FAR", label: "5%超", match: v => v > 5 },
    ],
  },
  {
    id: "volumeRatio",
    title: "⑤ 初検出日の出来高",
    description: "初検出日の出来高 ÷ それ以前20営業日の平均出来高",
    bins: [
      { id: "HIGH", label: "直前20日平均の1.2倍以上", match: v => v >= 1.2 },
      { id: "NORMAL", label: "1.2倍未満", match: v => v < 1.2 },
    ],
  },
];

const round = v => Math.round(v * 100) / 100;
const isFinitePositive = v => typeof v === "number" && Number.isFinite(v) && v > 0;

export function frozenNecklineFeatures(event, completedBars) {
  if (!event || !Array.isArray(completedBars)
      || !Number.isInteger(event.firstSeenIndex)
      || !Number.isInteger(event.first)
      || !Number.isInteger(event.second)
      || event.first < 0 || event.first >= event.second
      || event.second + 2 > event.firstSeenIndex
      || event.firstSeenIndex >= completedBars.length) return null;
  const seen = event.firstSeenIndex;
  const first = completedBars[event.first], second = completedBars[event.second], observed = completedBars[seen];
  if (!first || !second || !observed || !isFinitePositive(event.neckline)
      || !isFinitePositive(event.low1) || !isFinitePositive(event.low2)
      || !isFinitePositive(observed.close)) return null;

  // All three pivots and every candle read below exist by the first detection.
  const priorVolumes = completedBars.slice(Math.max(0, seen - 20), seen).map(b => b.volume);
  const volumeRatio = priorVolumes.length === 20
    && priorVolumes.every(isFinitePositive)
    && isFinitePositive(observed.volume)
    ? observed.volume / (priorVolumes.reduce((sum, v) => sum + v, 0) / 20)
    : null;

  const measurements = {
    bottomGap: event.second - event.first,
    lowDifferencePercent: Math.abs(event.low1 - event.low2) / Math.max(event.low1, event.low2) * 100,
    heightPercent: (event.neckline / Math.max(event.low1, event.low2) - 1) * 100,
    necklineDistancePercent: (event.neckline / observed.close - 1) * 100,
    volumeRatio,
  };

  const measurementsValid = Object.entries(measurements).every(
    ([name, v]) => v === null && name === "volumeRatio"
      || typeof v === "number" && Number.isFinite(v) && (name !== "volumeRatio" || v > 0),
  );
  if (!measurementsValid) return null;
  const bins = Object.fromEntries(NECKLINE_FEATURE_AXES.map(axis => [
    axis.id,
    measurements[axis.id] === null
      ? "UNKNOWN"
      : axis.bins.find(bin => bin.match(measurements[axis.id]))?.id ?? "UNKNOWN",
  ]));
  // Never persist more precision than needed for display. Buckets are based on
  // original unrounded numbers to avoid threshold-edge disagreements.
  return {
    observedAtTime: observed.time,
    measurements: Object.fromEntries(Object.entries(measurements).map(([key, value]) => [key, value == null ? null : round(value)])),
    buckets: bins,
  };
}

function outcomes(values) {
  const sorted = values.filter(v => typeof v === "number" && Number.isFinite(v)).sort((a, b) => a - b);
  if (!sorted.length) return { completed: 0, meanPercent: null, positivePercent: null, worstPercent: null };
  return {
    completed: sorted.length,
    meanPercent: round(sorted.reduce((sum, n) => sum + n, 0) / sorted.length),
    positivePercent: round(100 * sorted.filter(n => n > 0).length / sorted.length),
    worstPercent: round(sorted[0]),
  };
}

function summarizeGroup(events, bin) {
  const rows = events.filter(e => (e.frozenFeatures?.buckets?.[bin.axisId] ?? "UNKNOWN") === bin.id);
  const breakout = rows.filter(e => e.status === "BREAKOUT").length;
  const invalidated = rows.filter(e => e.status === "INVALIDATED").length;
  const expired = rows.filter(e => e.status === "EXPIRED").length;
  const pending = rows.filter(e => e.status === "WATCH").length;
  const resolved = breakout + invalidated + expired;
  const symbols = new Set(rows.map(e => e.code)).size;
  const dates = new Set(rows.map(e => e.firstSeenDate)).size;
  return {
    id: bin.id, label: bin.label,
    candidates: rows.length,
    distinctSymbols: symbols,
    distinctDates: dates,
    breakout, invalidated, expired, pending, resolved,
    resolvedBreakoutPercent: resolved ? round(breakout / resolved * 100) : null,
    early3: outcomes(rows.map(e => e.earlyReturn3)),
    early5: outcomes(rows.map(e => e.earlyReturn5)),
    // Even a large number in this historical 5-stock replay is NOT
    // independent out-of-sample verification.
    descriptiveSampleReady: rows.length >= NECKLINE_MIN_EXPLORATORY_EVENTS
      && symbols >= NECKLINE_MIN_INDEPENDENT_SYMBOLS,
    selectionValidated: false, // historic replay alone can never validate a buy rule
  };
}

/**
 * Classify ALL original candidates in an exhaustive, predeclared manner.
 * Reports disjoint bins per feature axis; missing volume is its own bin.
 * This does not mine combinations or rank buckets by their realized returns.
 */
export function summarizeFrozenNecklineFeatures(events) {
  if (!Array.isArray(events)) throw new Error("events must be an array");
  const axes = NECKLINE_FEATURE_AXES.map(axis => {
    const bins = [...axis.bins.map(bin => ({ ...bin, axisId: axis.id })), {
      id: "UNKNOWN", axisId: axis.id, label: "データ不足",
    }];
    const groups = bins.map(bin => summarizeGroup(events, bin))
      .filter(row => row.candidates || row.id !== "UNKNOWN");
    const assigned = groups.reduce((sum, row) => sum + row.candidates, 0);
    if (assigned !== events.length) throw new Error("candidate cohort mismatch: " + axis.id);
    return { id: axis.id, title: axis.title, description: axis.description, groups };
  });
  return {
    version: NECKLINE_FEATURE_VERSION,
    sampleCandidates: events.length,
    exploratoryOnly: true,
    selectionValidated: false,
    axes,
  };
}
