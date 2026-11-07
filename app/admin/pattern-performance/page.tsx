import pool from "@/app/lib/postgres";
import { getAdminSession } from "@/app/lib/admin";
import { chartPatternCatalog } from "@/app/lib/chartPatternCatalog";
import {
  getPatternForwardStats,
  type PatternForwardStats,
} from "@/app/lib/learning/patternForwardLearning";
import { calculateValidatedPatternStatBonus } from "@/app/lib/learning/patternForwardBonus";

export const dynamic = "force-dynamic";

function percent(value: number | null) {
  return value === null ? "—" : `${value.toFixed(1)}%`;
}

function signed(value: number | null) {
  if (value === null) return "—";
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}

function statusLabel(status: PatternForwardStats["validationStatus"] | "NOT_SEEN") {
  if (status === "VALIDATED") return "✅ 検証済み";
  if (status === "PROMISING") return "🟢 有望";
  if (status === "OBSERVATION_ONLY") return "⚪ 観察";
  if (status === "COLLECTING") return "🟡 収集中";
  return "未発生";
}


type PeriodResult = {
  cohort: string; phase: string; cases: number; days: number; codes: number;
  first_date: string; last_date: string; mean: number; median: number; excess: number; deep_loss: number;
};

async function PatternPeriodComparison() {
  try {
    const {rows} = await pool.query<PeriodResult>(`
WITH base AS (
 SELECT trade_date,code,ceil(entry_price/500) band,return_5d r
 FROM public.swing_universe_observations
 WHERE rule_version='ai_power_only_v1' AND entry_price>0 AND entry_price<=5000 AND return_5d IS NOT NULL
), bench AS (
 SELECT trade_date,band,count(*) n,sum(r) total FROM base GROUP BY 1,2
), patterns AS (
 SELECT trade_date,code,bool_or(pattern_id='pattern018') high_break,
 bool_or(pattern_id='pattern043') volume_break
 FROM public.pattern_forward_observations
 WHERE direction='BUY' AND pattern_id IN ('pattern018','pattern043')
 AND created_at < ((trade_date+1)::timestamp AT TIME ZONE 'Asia/Tokyo')
 GROUP BY 1,2
), cases AS (
 SELECT b.*,CASE WHEN p.high_break AND p.volume_break THEN 'BOTH'
 WHEN p.high_break THEN 'HIGH' ELSE 'VOLUME' END cohort,
 b.r-(g.total-b.r)/(g.n-1) excess
 FROM base b JOIN bench g USING(trade_date,band)
 JOIN patterns p USING(trade_date,code) WHERE g.n>1
)
SELECT cohort,CASE WHEN trade_date<'2026-10-20' THEN 'EARLY' ELSE 'LATE' END phase,
 count(*)::int cases,count(DISTINCT trade_date)::int days,count(DISTINCT code)::int codes,
 min(trade_date)::text first_date,max(trade_date)::text last_date,
 avg(r)::float8 mean,percentile_cont(.5) WITHIN GROUP(ORDER BY r)::float8 median,
 avg(excess)::float8 excess,
 count(*) FILTER(WHERE r<=-5)::int deep_loss
FROM cases GROUP BY 1,2 ORDER BY 1,2
    `);
    const labels: Record<string,string> = {BOTH:"高値更新＋出来高急増",HIGH:"高値更新のみ",VOLUME:"出来高急増のみ"};
    return <section className="mt-5 rounded-2xl border bg-white p-3">
      <h2 className="text-base font-black">ブレイク形状・期間別の再現性</h2>
      <p className="mt-2 text-xs leading-5 text-slate-600">
        100株50万円以内。判定日中に保存された買い形状を、銘柄・日ごとに集計。
        5日後の保存価格による騰落率を、同日の同価格帯（株価500円刻み）の他銘柄と比較します。
        費用控除前。2026年10月20日で分けた探索的な比較です。
      </p>
      {rows.length === 0 ? <p className="mt-3 text-sm">比較可能な記録はまだありません。</p> :
      <div className="mt-3 overflow-x-auto">
        <table className="w-full whitespace-nowrap text-right text-xs tabular-nums">
          <caption className="sr-only">買い形状別の5日後成績と期間差</caption>
          <thead><tr className="border-b">
            {["形状・期間","件／日／銘柄","平均","中央値","比較対象との差","−5%以下"].map(label =>
              <th scope="col" key={label} className="px-2 py-2">{label}</th>)}
          </tr></thead>
          <tbody>{rows.map(row => <tr key={row.cohort + row.phase} className="border-b border-slate-100">
            <th scope="row" className="px-2 py-2 text-left">
              {labels[row.cohort] ?? row.cohort}・{row.phase === "EARLY" ? "前半" : "後半"}
              <span className="block text-[10px] font-normal text-slate-500">{row.first_date}〜{row.last_date}</span>
            </th>
            <td className="px-2">{row.cases}／{row.days}／{row.codes}</td>
            <td className="px-2">{signed(row.mean)}</td>
            <td className="px-2">{signed(row.median)}</td>
            <td className="px-2">{row.excess > 0 ? "+" : ""}{row.excess.toFixed(2)}pt</td>
            <td className="px-2">{row.deep_loss}／{row.cases}</td>
          </tr>)}</tbody>
        </table>
      </div>}
      <p className="mt-2 text-xs leading-5 text-slate-600">
        5日後価格が揃った記録だけが対象。同じ銘柄の別日検出は別件です。
        朝9:15からの損益は別途検証が必要です。
      </p>
    </section>;
  } catch(error) {
    console.error("Pattern period comparison unavailable",error);
    return <p role="status" className="mt-4 text-sm">期間別比較を取得できませんでした。</p>;
  }
}

export default async function PatternPerformancePage() {
  const { isAdmin } = await getAdminSession();

  if (!isAdmin) {
    return (
      <main style={{ padding: 24, maxWidth: 900, margin: "0 auto" }}>
        <h1 style={{ fontSize: 28, fontWeight: 900 }}>パターン実績</h1>
        <p style={{ marginTop: 16 }}>管理者のみ閲覧できます。</p>
      </main>
    );
  }

  const stats = await getPatternForwardStats();
  const byId = new Map(stats.map((item) => [item.patternId, item]));
  const totalSamples = stats.reduce((sum, item) => sum + item.sampleCount, 0);
  const completed5d = stats.reduce((sum, item) => sum + item.completed5dCount, 0);
  const validated = stats.filter((item) => item.validationStatus === "VALIDATED").length;
  const promising = stats.filter((item) => item.validationStatus === "PROMISING").length;

  return (
    <main style={{ padding: 20, maxWidth: 1280, margin: "0 auto" }}>
      <h1 style={{ fontSize: 28, fontWeight: 950 }}>📚 SIGNALX パターン実績学習</h1>
      <p style={{ marginTop: 8, color: "#666", lineHeight: 1.7 }}>
        55種類のチャートパターンについて、発生日の株価を基準に1・3・5営業日後を自動追跡します。
        BUYは上昇、SELLは下落を「的中」として集計し、コマなどNEUTRALは勝敗を付けず値動きだけ記録します。
      </p>

      <section style={{ marginTop: 20, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 10 }}>
        {[
          ["対象パターン", chartPatternCatalog.length],
          ["検出記録", totalSamples],
          ["5日後確定", completed5d],
          ["検証済み", validated],
          ["有望", promising],
        ].map(([label, value]) => (
          <div key={String(label)} style={{ border: "1px solid #e5e7eb", borderRadius: 16, padding: 16, background: "#fff" }}>
            <div style={{ fontSize: 12, color: "#666", fontWeight: 800 }}>{label}</div>
            <div style={{ fontSize: 28, fontWeight: 950, marginTop: 4 }}>{value}</div>
          </div>
        ))}
      </section>

      <PatternPeriodComparison />

      <section style={{ marginTop: 18, overflowX: "auto", border: "1px solid #e5e7eb", borderRadius: 16, background: "#fff" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 1050 }}>
          <thead>
            <tr style={{ background: "#f8fafc", textAlign: "left" }}>
              {["ID", "パターン", "方向", "状態", "AI反映", "発生", "1日勝率", "3日勝率", "5日勝率", "5日平均", "5日中央値", "銘柄数", "日数"].map((heading) => (
                <th key={heading} style={{ padding: "12px 10px", borderBottom: "1px solid #e5e7eb", fontSize: 12 }}>{heading}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {chartPatternCatalog.map((pattern) => {
              const item = byId.get(pattern.id);
              const status = item?.validationStatus ?? "NOT_SEEN";
              return (
                <tr key={pattern.id}>
                  <td style={{ padding: "10px", borderBottom: "1px solid #f1f5f9", fontFamily: "monospace" }}>{pattern.id}</td>
                  <td style={{ padding: "10px", borderBottom: "1px solid #f1f5f9", fontWeight: 900 }}>{pattern.name}</td>
                  <td style={{ padding: "10px", borderBottom: "1px solid #f1f5f9" }}>{pattern.direction}</td>
                  <td style={{ padding: "10px", borderBottom: "1px solid #f1f5f9", whiteSpace: "nowrap" }}>{statusLabel(status)}</td>
                  <td style={{ padding: "10px", borderBottom: "1px solid #f1f5f9", fontWeight: 900 }}>
                    {item && calculateValidatedPatternStatBonus(item) !== 0
                      ? `${calculateValidatedPatternStatBonus(item) > 0 ? "+" : ""}${calculateValidatedPatternStatBonus(item)}`
                      : "—"}
                  </td>
                  <td style={{ padding: "10px", borderBottom: "1px solid #f1f5f9" }}>{item?.sampleCount ?? 0}</td>
                  <td style={{ padding: "10px", borderBottom: "1px solid #f1f5f9" }}>{percent(item?.winRate1d ?? null)}</td>
                  <td style={{ padding: "10px", borderBottom: "1px solid #f1f5f9" }}>{percent(item?.winRate3d ?? null)}</td>
                  <td style={{ padding: "10px", borderBottom: "1px solid #f1f5f9", fontWeight: 900 }}>{percent(item?.winRate5d ?? null)}</td>
                  <td style={{ padding: "10px", borderBottom: "1px solid #f1f5f9" }}>{signed(item?.avgDirectionalReturn5d ?? null)}</td>
                  <td style={{ padding: "10px", borderBottom: "1px solid #f1f5f9" }}>{signed(item?.medianDirectionalReturn5d ?? null)}</td>
                  <td style={{ padding: "10px", borderBottom: "1px solid #f1f5f9" }}>{item?.distinctCodes ?? 0}</td>
                  <td style={{ padding: "10px", borderBottom: "1px solid #f1f5f9" }}>{item?.distinctDates ?? 0}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      <p style={{ marginTop: 14, color: "#666", fontSize: 12, lineHeight: 1.7 }}>
        判定基準: 5営業日後が50件以上・30銘柄以上・15日以上、方向一致率60%以上、
        方向補正後の平均騰落率+0.5%以上かつ中央値プラスで「検証済み」。
        20件以上の早期条件を満たした段階は「有望」と表示します。現段階では実績を収集するシャドー学習で、
        「検証済み」になったBUY/SELLパターンだけ、次回以降のスキャンからAI POWERへ自動反映します。
        影響は1パターン最大±6点に制限し、未検証・有望・NEUTRALはAI POWERを変更しません。
      </p>
    </main>
  );
}
