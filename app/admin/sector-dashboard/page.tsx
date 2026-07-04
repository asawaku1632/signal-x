type Sector = {
  rank: number;
  rankLabel: string;
  sectorKey: string;
  sectorName: string;
  win: number;
  lose: number;
  hold: number;
  total: number;
  winRate: number;
  aiBonus: number;
  confidence: number;
  evaluation: string;
};

async function getSectorDashboard() {
  const baseUrl =
    process.env.NEXTAUTH_URL || "http://localhost:3000";

  const res = await fetch(
    `${baseUrl}/api/sector-learning/dashboard`,
    {
      cache: "no-store",
    }
  );

  return res.json();
}

function getEvaluationLabel(evaluation: string) {
  switch (evaluation) {
    case "S_STRONG_SECTOR":
      return "最強セクター";
    case "A_STRONG_SECTOR":
      return "強いセクター";
    case "B_GOOD_SECTOR":
      return "良好";
    case "C_WATCH_SECTOR":
      return "監視";
    case "KEEP":
      return "様子見";
    case "WEAK_SECTOR":
      return "弱い";
    default:
      return "データ不足";
  }
}

function getBonusText(bonus: number) {
  if (bonus > 0) return `+${bonus}`;
  return String(bonus);
}

export default async function SectorDashboardPage() {
  const data = await getSectorDashboard();

  const sectors: Sector[] = data.sectors ?? [];

  return (
    <main style={{ padding: 24, maxWidth: 1100, margin: "0 auto" }}>
      <h1 style={{ fontSize: 28, fontWeight: 800 }}>
        📊 Sector Dashboard
      </h1>

      <p style={{ color: "#666", marginTop: 8 }}>
        V13.6 / セクター別の勝率・AI BONUS・Confidenceを表示
      </p>

      <section
        style={{
          marginTop: 24,
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
          gap: 16,
        }}
      >
        {sectors.map((sector) => (
          <div
            key={sector.sectorKey}
            style={{
              border: "1px solid #e5e7eb",
              borderRadius: 16,
              padding: 18,
              background: "#fff",
              boxShadow: "0 6px 18px rgba(0,0,0,0.06)",
            }}
          >
            <div style={{ fontSize: 24, fontWeight: 800 }}>
              {sector.rankLabel} {sector.sectorName}
            </div>

            <div
              style={{
                marginTop: 8,
                color: "#666",
                fontSize: 13,
              }}
            >
              {sector.sectorKey}
            </div>

            <div style={{ marginTop: 16 }}>
              <div style={{ fontSize: 14, color: "#666" }}>
                勝率
              </div>
              <div style={{ fontSize: 34, fontWeight: 900 }}>
                {sector.winRate}%
              </div>
            </div>

            <div
              style={{
                marginTop: 10,
                height: 10,
                borderRadius: 999,
                background: "#e5e7eb",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  width: `${Math.min(sector.winRate, 100)}%`,
                  height: "100%",
                  background: "#111827",
                }}
              />
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 12,
                marginTop: 18,
              }}
            >
              <div>
                <div style={{ fontSize: 12, color: "#666" }}>
                  AI BONUS
                </div>
                <div style={{ fontSize: 22, fontWeight: 800 }}>
                  {getBonusText(sector.aiBonus)}
                </div>
              </div>

              <div>
                <div style={{ fontSize: 12, color: "#666" }}>
                  Confidence
                </div>
                <div style={{ fontSize: 22, fontWeight: 800 }}>
                  {sector.confidence}%
                </div>
              </div>

              <div>
                <div style={{ fontSize: 12, color: "#666" }}>
                  学習件数
                </div>
                <div style={{ fontSize: 22, fontWeight: 800 }}>
                  {sector.total}
                </div>
              </div>

              <div>
                <div style={{ fontSize: 12, color: "#666" }}>
                  評価
                </div>
                <div style={{ fontSize: 15, fontWeight: 700 }}>
                  {getEvaluationLabel(sector.evaluation)}
                </div>
              </div>
            </div>

            <div
              style={{
                marginTop: 14,
                fontSize: 13,
                color: "#555",
              }}
            >
              WIN {sector.win} / LOSE {sector.lose} / HOLD{" "}
              {sector.hold}
            </div>
          </div>
        ))}
      </section>
    </main>
  );
}