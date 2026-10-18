import "server-only";
import pool from "@/app/lib/postgres";

export type ResearchCategory = "swing" | "surge" | "ai_rise" | "sharp_drop";
export type ResearchEvidence = {
  key: ResearchCategory;
  title: string;
  observed: number;
  completed5: number;
  settledDays: number;
  latestSignalDate: string | null;
  meanReturn5: number | null;
  riseRate5: number | null;
  declineRate5: number | null;
  benchmarked5: number;
  reviewStatus: "RESEARCH_ONLY";
  deliveryEnabled: false;
  reasons: string[];
};

type Aggregate = {
  observed: string;
  completed5: string;
  settled_days: string;
  latest_signal_date: string | Date | null;
  mean_return5: string | null;
  up5: string;
  down5: string;
  benchmarked5: string;
};

const dayOnly = (value: string | Date | null) =>
  value ? (value instanceof Date ? value.toISOString().slice(0, 10) : String(value).slice(0, 10)) : null;
const ratio = (numerator: number, denominator: number) =>
  denominator ? Math.round(numerator / denominator * 1000) / 10 : null;
const numeric = (value: string | number | null | undefined) =>
  value === null || value === undefined ? null : Number.isFinite(Number(value)) ? Number(value) : null;

const SWING_SQL = `
  SELECT COUNT(*)::text AS observed,
    COUNT(return_5d)::text AS completed5,
    COUNT(DISTINCT trade_date) FILTER (WHERE return_5d IS NOT NULL)::text AS settled_days,
    MAX(trade_date) AS latest_signal_date,
    ROUND(AVG(return_5d), 4)::text AS mean_return5,
    COUNT(*) FILTER (WHERE return_5d > 0)::text AS up5,
    COUNT(*) FILTER (WHERE return_5d < 0)::text AS down5,
    '0'::text AS benchmarked5
  FROM public.swing_universe_observations
  WHERE rule_version = 'ai_power_only_v1' AND decision_status = 'CANDIDATE'
`;

const SURGE_SQL = `
  SELECT COUNT(*)::text AS observed,
    COUNT(result_5d)::text AS completed5,
    COUNT(DISTINCT trade_date) FILTER (WHERE result_5d IS NOT NULL)::text AS settled_days,
    MAX(trade_date) AS latest_signal_date,
    ROUND(AVG(result_5d), 4)::text AS mean_return5,
    COUNT(*) FILTER (WHERE result_5d > 0)::text AS up5,
    COUNT(*) FILTER (WHERE result_5d < 0)::text AS down5,
    COUNT(excess_return_5d)::text AS benchmarked5
  FROM public.momentum_memory_observations
  WHERE signal_version = 'MM_V1' AND profile_key = 'EXPLOSIVE_REBOUND'
`;

// Strict, historical shadow definitions: neither event has been proven
// to predict an actionable outcome. Full saved sessions only; no intraday calls.
const DAILY_RESEARCH_SQL = `
 WITH days AS (
    SELECT date, row_number() OVER (ORDER BY date) AS seq
    FROM (
      SELECT date FROM public.daily_stock_results
      WHERE date ~ '^20[0-9]{2}-[0-9]{2}-[0-9]{2}$'
        AND EXTRACT(ISODOW FROM date::date) BETWEEN 1 AND 5
      GROUP BY date HAVING COUNT(*) >= 800
    ) full_dates
  ),
  history AS (
    SELECT p.code, p.date, d.seq, p.score, p.price,
      LAG(p.score) OVER (PARTITION BY p.code ORDER BY d.seq) AS previous_score,
      LAG(p.price) OVER (PARTITION BY p.code ORDER BY d.seq) AS previous_price,
      LAG(d.seq) OVER (PARTITION BY p.code ORDER BY d.seq) AS previous_seq,
      LEAD(p.price, 5) OVER (PARTITION BY p.code ORDER BY d.seq) AS future5_price,
      LEAD(d.seq, 5) OVER (PARTITION BY p.code ORDER BY d.seq) AS future5_seq
    FROM public.daily_stock_results p
    JOIN days d ON d.date = p.date
    WHERE p.score BETWEEN 0 AND 100 AND p.price > 0
  ),
  events AS (
    SELECT date, seq, price, future5_price, future5_seq,
      CASE
        WHEN previous_seq = seq - 1 AND score - previous_score >= 20 AND score >= 75
          THEN 'ai_rise'
        WHEN previous_seq = seq - 1 AND price <= previous_price * 0.95
          AND previous_score - score >= 10 THEN 'sharp_drop'
        ELSE NULL
      END AS event_type
    FROM history
  )
  SELECT event_type,
    COUNT(*)::text AS observed,
    COUNT(*) FILTER (WHERE future5_seq = seq + 5 AND future5_price > 0)::text AS completed5,
    COUNT(DISTINCT date) FILTER (WHERE future5_seq = seq + 5 AND future5_price > 0)::text AS settled_days,
    MAX(date) AS latest_signal_date,
    ROUND(AVG(100.0 * (future5_price - price) / price)
      FILTER (WHERE future5_seq = seq + 5 AND future5_price > 0)::numeric, 4)::text AS mean_return5,
    COUNT(*) FILTER (WHERE future5_seq = seq + 5 AND future5_price > price)::text AS up5,
    COUNT(*) FILTER (WHERE future5_seq = seq + 5 AND future5_price < price)::text AS down5,
    '0'::text AS benchmarked5
  FROM events WHERE event_type IS NOT NULL GROUP BY event_type
`;

function present(key: ResearchCategory, title: string, row?: Aggregate): ResearchEvidence {
  const observed = Number(row?.observed ?? 0);
  const completed5 = Number(row?.completed5 ?? 0);
  const settledDays = Number(row?.settled_days ?? 0);
  const up = Number(row?.up5 ?? 0);
  const down = Number(row?.down5 ?? 0);
  const benchmarked5 = Number(row?.benchmarked5 ?? 0);
  const latestSignalDate = dayOnly(row?.latest_signal_date ?? null);
  const reasons: string[] = [];

  if (completed5 < 200) reasons.push(`5日後の検証件数が不足（${completed5}/200）`);
  if (settledDays < 20) reasons.push(`検証した予測日が不足（${settledDays}/20日）`);
  if (key === "swing") {
    reasons.push("現在はAI POWERだけを使う簡易判定。別期間・市場平均との比較が未完了");
  }
  if (key === "surge") {
    if (benchmarked5 < 150) reasons.push("市場平均を上回るか検証するデータが不足");
    if (!latestSignalDate || Date.now() - Date.parse(latestSignalDate + "T00:00:00Z") > 30 * 86400000) {
      reasons.push("直近の爆益前兆研究シグナルが不足");
    }
  }
  if (key === "ai_rise") {
    reasons.push("株価とAI POWERの過去データに基づく試算。市場対比と独立期間での検証が必要");
  }
  if (key === "sharp_drop") {
    const declineRate = ratio(down, completed5);
    if (declineRate === null || declineRate < 60) reasons.push("急落後にさらに下がる割合は警戒通知の根拠として不十分");
    reasons.push("『既に下落した』条件と『これから下落する』予測は別。再検証が必要");
  }
  // Never graduate a research signal automatically. Release requires a
  // separately reviewed, version-pinned model and a guarded send path.
  reasons.push("配信解禁には独立した再検証と明示的な承認が必要");
  return {
    key, title, observed, completed5, settledDays, latestSignalDate,
    meanReturn5: numeric(row?.mean_return5),
    riseRate5: ratio(up, completed5),
    declineRate5: ratio(down, completed5),
    benchmarked5,
    reviewStatus: "RESEARCH_ONLY",
    deliveryEnabled: false,
    reasons,
  };
}

export async function getNotificationResearchEvidence() {
  const [swing, surge, daily] = await Promise.all([
    pool.query<Aggregate>(SWING_SQL),
    pool.query<Aggregate>(SURGE_SQL),
    pool.query<Aggregate & { event_type: ResearchCategory }>(DAILY_RESEARCH_SQL),
  ]);
  const byType = new Map(daily.rows.map((row) => [row.event_type, row]));
  return {
    checkedAt: new Date().toISOString(),
    note: "予測時点で保存された値と、その後5つ先の十分な日次保存データを比較した研究統計です。購入の約定や将来の損益、予測の有効性を保証しません。",
    automaticRelease: false,
    categories: [
      present("swing", "📈 スイング候補", swing.rows[0]),
      present("surge", "🚀 爆益前兆", surge.rows[0]),
      present("ai_rise", "⚡ AI評価急上昇", byType.get("ai_rise")),
      present("sharp_drop", "⚠️ 急落警戒", byType.get("sharp_drop")),
    ],
  };
}
