import { getAdminSession } from "@/app/lib/admin";
import { chartPatternCatalog } from "@/app/lib/chartPatternCatalog";
import {
  getPatternForwardStats,
  type PatternForwardStats,
} from "@/app/lib/learning/patternForwardLearning";

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

      <section style={{ marginTop: 18, overflowX: "auto", border: "1px solid #e5e7eb", borderRadius: 16, background: "#fff" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 1050 }}>
          <thead>
            <tr style={{ background: "#f8fafc", textAlign: "left" }}>
              {["ID", "パターン", "方向", "状態", "発生", "1日勝率", "3日勝率", "5日勝率", "5日平均", "5日中央値", "銘柄数", "日数"].map((heading) => (
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
        AI POWERへの自動加点にはまだ使用しません。
      </p>
    </main>
  );
}
