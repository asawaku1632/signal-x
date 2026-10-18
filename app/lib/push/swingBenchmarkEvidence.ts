import "server-only";
import pool from "@/app/lib/postgres";

// This report is isolated, read-only and NEVER approves research push delivery.
// "Market average" is the equal-weighted return of the saved SIGNALX universe,
// not a TOPIX or Nikkei index, and all prices are saved close/reference prices.
const VERIFIED_RULE_VERSION = "ai_power_only_v1";
const MIN_SETTLED_SIGNALS = 200;
const MIN_DISTINCT_PREDICTION_DAYS = 20;
const MIN_DISTINCT_WEEKS = 6;
const MIN_COMPARISON_COVERAGE = 0.95;
const OUTLIER_REVIEW_ABSOLUTE_PERCENT = 50;

type HistoricalRow = {
  code: string;
  signal_date: string;
  target_date: string;
  return5: string;
  benchmark5: string | null;
  coverage: string;
  worst_closing_drop: string | null;
  prices_count: string | null;
};

const HISTORICAL_SQL = `
WITH full_sessions AS (
  SELECT date, ROW_NUMBER() OVER (ORDER BY date) AS session_number
  FROM public.daily_stock_results
  WHERE date ~ '^20[0-9]{2}-[0-9]{2}-[0-9]{2}$'
  GROUP BY date HAVING COUNT(*) >= 800
), settled AS (
  SELECT o.code, o.trade_date::text AS signal_date,
    o.outcome_5d_date::text AS target_date,
    o.entry_price::numeric AS entry_price,
    o.return_5d::numeric AS return5,
    d0.session_number AS seq0, d5.session_number AS seq5
  FROM public.swing_universe_observations o
  JOIN full_sessions d0 ON d0.date = o.trade_date::text
  JOIN full_sessions d5 ON d5.date = o.outcome_5d_date::text
    AND d5.session_number = d0.session_number + 5
  WHERE o.rule_version = $1 AND o.decision_status = 'CANDIDATE'
    AND o.return_5d IS NOT NULL AND o.entry_price > 0
    AND o.trade_date >= CURRENT_DATE - INTERVAL '180 days'
  ORDER BY o.trade_date DESC, o.code ASC LIMIT 4000
), date_pairs AS (
  SELECT DISTINCT signal_date,target_date FROM settled
), universe_benchmark AS (
  SELECT d.signal_date, d.target_date, COUNT(*) AS coverage,
    AVG((future.price / baseline.price - 1) * 100) AS average_return
  FROM date_pairs d
  JOIN public.daily_stock_results baseline
    ON baseline.date = d.signal_date AND baseline.price > 0
  JOIN public.daily_stock_results future
    ON future.date = d.target_date AND future.code = baseline.code AND future.price > 0
  GROUP BY d.signal_date,d.target_date
), interim AS (
  SELECT c.code,c.signal_date,COUNT(*) AS prices_count,
    MIN((p.price / c.entry_price - 1) * 100) AS worst_percent
  FROM settled c
  JOIN full_sessions d ON d.session_number > c.seq0 AND d.session_number <= c.seq5
  JOIN public.daily_stock_results p ON p.code = c.code AND p.date = d.date AND p.price > 0
  GROUP BY c.code,c.signal_date
)
SELECT c.code,c.signal_date,c.target_date,
  c.return5::text AS return5,
  CASE WHEN b.coverage >= 800 THEN b.average_return::text ELSE NULL END AS benchmark5,
  b.coverage::text AS coverage,
  CASE WHEN w.prices_count = 5
    THEN LEAST(0,w.worst_percent)::text ELSE NULL END AS worst_closing_drop,
  w.prices_count::text AS prices_count
FROM settled c
JOIN universe_benchmark b ON b.signal_date = c.signal_date AND b.target_date = c.target_date
LEFT JOIN interim w ON w.code = c.code AND w.signal_date = c.signal_date
ORDER BY c.signal_date DESC,c.code
`;

function average(values: number[]): number | null {
  return values.length ? values.reduce((s, n) => s + n, 0) / values.length : null;
}
function median(values: number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a,b) => a-b);
  const m = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[m] : (sorted[m-1] + sorted[m]) / 2;
}
function trimmedMean(values: number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a,b) => a-b);
  const trim = Math.floor(sorted.length * .1);
  return average(sorted.slice(trim, sorted.length-trim));
}
function percent(part: number,total: number) {
  return total ? part * 100 / total : null;
}
function round(value: number | null, digits = 2): number | null {
  return value == null || !Number.isFinite(value) ? null : Number(value.toFixed(digits));
}
function isoWeekStart(date: string) {
  const d = new Date(date + "T00:00:00Z");
  if (!Number.isFinite(d.getTime())) throw new Error("Invalid saved prediction date");
  const delta = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - delta);
  return d.toISOString().slice(0,10);
}

type Evidence = { date: string; value: number; benchmark: number | null; drawdown: number | null };

export function summarizeSwingComparison(input: Evidence[]) {
  const settled = input.length;
  const returns = input.map(x=>x.value);
  const benchmarks = input.filter(x=>x.benchmark!==null);
  const excesses = benchmarks.map(x=>x.value-x.benchmark!);
  const risk = input.filter(x=>x.drawdown!==null);
  const days = new Set(input.map(x=>x.date));
  const weeks = new Map<string,Evidence[]>();
  for(const row of input){
    const monday=isoWeekStart(row.date);
    weeks.set(monday,[...(weeks.get(monday)??[]),row]);
  }
  const weekly = [...weeks.entries()].sort(([a],[b])=>b.localeCompare(a)).slice(0,12).map(([weekStart,cohort])=>{
    const validBenchmarks = cohort.filter(x=>x.benchmark!==null);
    const validRisks = cohort.filter(x=>x.drawdown!==null);
    return {
      weekStart,
      count:cohort.length,
      predictionDays:new Set(cohort.map(x=>x.date)).size,
      meanReturn:round(average(cohort.map(x=>x.value))),
      medianReturn:round(median(cohort.map(x=>x.value))),
      marketAverage:round(average(validBenchmarks.map(x=>x.benchmark!))),
      averageExcess:round(average(validBenchmarks.map(x=>x.value-x.benchmark!))),
      worstSavedCloseDrop:round(validRisks.length?Math.min(...validRisks.map(x=>x.drawdown!)):null),
      riskCoverage:validRisks.length,
    };
  });
  const highOutliers = input.filter(x=>Math.abs(x.value)>=OUTLIER_REVIEW_ABSOLUTE_PERCENT).length;
  const gates = [
    {key:"settled",label:"5日後の検証件数",current:settled,required:MIN_SETTLED_SIGNALS,passed:settled>=MIN_SETTLED_SIGNALS},
    {key:"days",label:"異なる予測日",current:days.size,required:MIN_DISTINCT_PREDICTION_DAYS,passed:days.size>=MIN_DISTINCT_PREDICTION_DAYS},
    {key:"weeks",label:"独立した週",current:weeks.size,required:MIN_DISTINCT_WEEKS,passed:weeks.size>=MIN_DISTINCT_WEEKS},
    {key:"benchmark",label:"市場平均との比較可能率",current:round(percent(benchmarks.length,settled),1)??0,required:MIN_COMPARISON_COVERAGE*100,passed:settled>0&&benchmarks.length/settled>=MIN_COMPARISON_COVERAGE,unit:"%"},
    {key:"risk",label:"途中5日分の株価取得率",current:round(percent(risk.length,settled),1)??0,required:MIN_COMPARISON_COVERAGE*100,passed:settled>0&&risk.length/settled>=MIN_COMPARISON_COVERAGE,unit:"%"},
  ];
  return {
    version:VERIFIED_RULE_VERSION,
    scope:"最近180日・直近4000件までの確定済みCANDIDATE",
    settled,
    predictionDays:days.size,
    predictionWeeks:weeks.size,
    riseRate:round(percent(returns.filter(x=>x>0).length,settled),1),
    meanReturn:round(average(returns)),
    medianReturn:round(median(returns)),
    trimmedMeanReturn:round(trimmedMean(returns)),
    marketAverage:round(average(benchmarks.map(x=>x.benchmark!))),
    meanExcess:round(average(excesses)),
    medianExcess:round(median(excesses)),
    marketComparable:benchmarks.length,
    worstFiveDayReturn:round(returns.length?Math.min(...returns):null),
    largestSavedCloseDrop:round(risk.length?Math.min(...risk.map(x=>x.drawdown!)):null),
    touchedMinusThreeRate:round(percent(risk.filter(x=>x.drawdown!<=-3).length,risk.length),1),
    riskComparable:risk.length,
    outliersOverFiftyPercent:highOutliers,
    gates,
    gatesPassed:gates.every(x=>x.passed),
    automaticNotificationRelease:false,
    deliveryEnabled:false,
    weekly,
    notes:[
      "市場平均は同一の開始・終了日に価格を保存したSIGNALX全銘柄の単純平均騰落率（等金額）であり、TOPIX・日経平均ではありません。",
      "途中下落率は予測時の保存価格から、続く5営業日の保存終値の最安値まで。日中安値・売買約定価格は含みません。",
      "中央値と上下10%を除いた平均も併記し、極端な値動きによる平均の偏りを確認します。元データは除外・変更しません。",
      "件数・週数が達成されても、独立期間での再現性と異常値を人が確認するまで配信は解禁しません。",
    ],
  };
}

export async function getSwingBenchmarkEvidence(){
  const result=await pool.query<HistoricalRow>(HISTORICAL_SQL,[VERIFIED_RULE_VERSION]);
  const cohort:Evidence[]=result.rows.map(row=>({
    date:row.signal_date,
    value:Number(row.return5),
    benchmark:row.benchmark5==null?null:Number(row.benchmark5),
    drawdown:row.worst_closing_drop==null?null:Number(row.worst_closing_drop),
  })).filter(row=>Number.isFinite(row.value) && (row.benchmark==null||Number.isFinite(row.benchmark))
    && (row.drawdown==null||Number.isFinite(row.drawdown)));
  return {checkedAt:new Date().toISOString(),...summarizeSwingComparison(cohort)};
}
