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

  const [stats, mixedDirections] = await Promise.all([
    getPatternForwardStats(),
    pool.query<{
      pattern_id: string;
      directions: string;
      samples: number;
      breakdown: Array<{ direction: string; detected: number; completed: number; hits: number }>;
    }>(`
      WITH per_direction AS (
        SELECT pattern_id, direction,
               COUNT(*)::int AS detected,
               COUNT(return_5d)::int AS completed,
               COUNT(*) FILTER (WHERE success_5d IS TRUE)::int AS hits
        FROM public.pattern_forward_observations
        GROUP BY pattern_id, direction
      )
      SELECT pattern_id,
             STRING_AGG(direction, ', ' ORDER BY direction) AS directions,
             SUM(detected)::int AS samples,
             JSON_AGG(
               JSON_BUILD_OBJECT('direction', direction, 'detected', detected,
                                 'completed', completed, 'hits', hits)
               ORDER BY direction
             ) AS breakdown
      FROM per_direction
      GROUP BY pattern_id
      HAVING COUNT(*) > 1
      ORDER BY SUM(detected) DESC
      LIMIT 20
    `),
  ]);
  const mixedDirectionIds = new Set(mixedDirections.rows.map((row) => row.pattern_id));
  const byId = new Map(stats.map((item) => [item.patternId, item]));
  const totalSamples = stats.reduce((sum, item) => sum + item.sampleCount, 0);
  const completed5d = stats.reduce((sum, item) => sum + item.completed5dCount, 0);
  const validated = stats.filter((item) => item.validationStatus === "VALIDATED").length;
  const completedRate = totalSamples > 0 ? (completed5d / totalSamples * 100).toFixed(1) : null;
  const promising = stats.filter((item) => item.validationStatus === "PROMISING").length;

  return (
    <main style={{ padding: 20, maxWidth: 1280, margin: "0 auto" }}>
      <h1 style={{ fontSize: 28, fontWeight: 950 }}>📚 SIGNALX パターン実績学習</h1>
      <p style={{ marginTop: 8, color: "#666", lineHeight: 1.7 }}>
        55種類のチャートパターンについて、発生日の株価を基準に1・3・5営業日後を自動追跡します。
        BUYは上昇、SELLは下落を「的中」として集計し、コマなどNEUTRALは勝敗を付けず値動きだけ記録します。
      </p>

      <p style={{ marginTop: 10, color: "#92400e", background: "#fffbeb", border: "1px solid #fcd34d", borderRadius: 12, padding: 12, lineHeight: 1.7 }}>
        勝率は観測した全件ではなく、該当営業日まで追跡が完了した方向判定可能な件数を母数とします。
        「発生」と「5日確定」は異なります。追跡率は検出記録のうち5日後まで確定した割合で、的中率ではありません。SELLの「方向補正」は株価下落をプラス評価する研究指標であり、
        実際の買い持ち損益とは異なります。必ず隣の「5日平均(株価)」と併せて確認してください。
      </p>

      {mixedDirections.rows.length > 0 && (
        <p style={{ marginTop: 12, padding: 12, borderRadius: 12, background: "#fff7ed", border: "1px solid #fdba74", lineHeight: 1.7 }}>
          ⚠ 同一パターンIDに複数の売買方向が混在しています。方向別に分けない集計の勝率・平均・AI反映評価は参考値です。
          {mixedDirections.rows.map((row) => (
            <span key={row.pattern_id} style={{ display: "block" }}>
              {row.pattern_id}: {row.directions}（{row.samples}件）
              {row.breakdown.map((part) => (
                <span key={part.direction} style={{ display: "block", paddingLeft: 14 }}>
                  {part.direction}: 検出{part.detected}件 / 5日確定{part.completed}件 / {part.direction === "NEUTRAL" ? "的中判定なし" : `的中${part.hits}件${part.completed > 0 ? `（${(part.hits / part.completed * 100).toFixed(1)}%）` : ""}`}
                </span>
              ))}
            </span>
          ))}
          既存の売買判定はこの画面から変更しません。
        </p>
      )}

      <section style={{ marginTop: 20, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 10 }}>
        {[
          ["対象パターン", chartPatternCatalog.length],
          ["検出記録", totalSamples],
          ["5日後確定", completed5d],
          ["5日後追跡率", completedRate === null ? "—" : `${completedRate}%`],
          ["検証済み", validated],
          ["有望", promising],
        ].map(([label, value]) => (
          <div key={String(label)} style={{ border: "1px solid #e5e7eb", borderRadius: 16, padding: 16, background: "#fff" }}>
            <div style={{ fontSize: 12, color: "#666", fontWeight: 800 }}>{label}</div>
            <div style={{ fontSize: 28, fontWeight: 950, marginTop: 4 }}>{value}</div>
          </div>
        ))}
      </section>

      <p style={{ marginTop: 12, color: "#334155", lineHeight: 1.7 }}>
        {validated === 0
          ? "現在、検証済みパターンは0件です。検証済みパターン由来のAI POWER加点・減点は発生しません。"
          : "検証済みパターンがあります。既存のAI POWER自動反映経路の影響を別途監査してください。"}
      </p>

      <section style={{ marginTop: 18, overflowX: "auto", border: "1px solid #e5e7eb", borderRadius: 16, background: "#fff" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 1050 }}>
          <thead>
            <tr style={{ background: "#f8fafc", textAlign: "left" }}>
              {["ID", "パターン", "方向", "状態", "AI反映", "発生", "5日確定", "1日勝率", "3日勝率", "5日勝率", "5日平均(方向補正)", "5日平均(株価)", "5日中央値(方向補正)", "銘柄数", "日数"].map((heading) => (
                <th key={heading} style={{ padding: "12px 10px", borderBottom: "1px solid #e5e7eb", fontSize: 12 }}>{heading}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {chartPatternCatalog.map((pattern) => {
              const item = byId.get(pattern.id);
              const status = item?.validationStatus ?? "NOT_SEEN";
              const mixedDirection = mixedDirectionIds.has(pattern.id);
              return (
                <tr key={pattern.id}>
                  <td style={{ padding: "10px", borderBottom: "1px solid #f1f5f9", fontFamily: "monospace" }}>{pattern.id}</td>
                  <td style={{ padding: "10px", borderBottom: "1px solid #f1f5f9", fontWeight: 900 }}>{pattern.name}</td>
                  <td style={{ padding: "10px", borderBottom: "1px solid #f1f5f9" }}>{pattern.direction}</td>
                  <td style={{ padding: "10px", borderBottom: "1px solid #f1f5f9", whiteSpace: "nowrap" }}>{mixedDirection ? "⚠ 方向混在・要分離" : statusLabel(status)}</td>
                  <td style={{ padding: "10px", borderBottom: "1px solid #f1f5f9", fontWeight: 900 }}>
                    {!mixedDirection && item && calculateValidatedPatternStatBonus(item) !== 0
                      ? `${calculateValidatedPatternStatBonus(item) > 0 ? "+" : ""}${calculateValidatedPatternStatBonus(item)}`
                      : "—"}
                  </td>
                  <td style={{ padding: "10px", borderBottom: "1px solid #f1f5f9" }}>{item?.sampleCount ?? 0}</td>
                  <td style={{ padding: "10px", borderBottom: "1px solid #f1f5f9", fontWeight: 900 }}>{item?.completed5dCount ?? 0}</td>
                  <td style={{ padding: "10px", borderBottom: "1px solid #f1f5f9" }}>{percent(item?.winRate1d ?? null)}</td>
                  <td style={{ padding: "10px", borderBottom: "1px solid #f1f5f9" }}>{percent(item?.winRate3d ?? null)}</td>
                  <td style={{ padding: "10px", borderBottom: "1px solid #f1f5f9", fontWeight: 900 }}>{percent(item?.winRate5d ?? null)}</td>
                  <td style={{ padding: "10px", borderBottom: "1px solid #f1f5f9" }}>{signed(item?.avgDirectionalReturn5d ?? null)}</td>
                  <td style={{ padding: "10px", borderBottom: "1px solid #f1f5f9" }}>{signed(item?.avgRawReturn5d ?? null)}</td>
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
