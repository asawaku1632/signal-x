type SectorRanking = {
  rank: number;
  rankLabel: string;
  sectorKey: string;
  sectorName: string;
  aiScore: number;
  flowLabel: string;
  winRate: number;
  aiBonus: number;
  confidence: number;
  total: number;
};

async function getSectorRanking() {
  const baseUrl =
    process.env.NEXTAUTH_URL || "http://localhost:3000";

  const res = await fetch(
    `${baseUrl}/api/sector-learning/ranking`,
    {
      cache: "no-store",
    }
  );

  return res.json();
}

function getBonusText(bonus: number) {
  if (bonus > 0) return `+${bonus}`;
  return String(bonus);
}

export default async function SectorRankingPage() {
  const data = await getSectorRanking();
  const ranking: SectorRanking[] = data.ranking ?? [];

  return (
    <main style={{ padding: 24, maxWidth: 1100, margin: "0 auto" }}>
      <h1 style={{ fontSize: 28, fontWeight: 800 }}>
        🧠 Sector Ranking AI
      </h1>

      <p style={{ color: "#666", marginTop: 8 }}>
        V13.7 / セクター別の資金循環・AI Score・勝率をランキング表示
      </p>

      <section style={{ marginTop: 24, display: "grid", gap: 14 }}>
        {ranking.map((sector) => (
          <div
            key={sector.sectorKey}
            style={{
              border: "1px solid #e5e7eb",
              borderRadius: 18,
              padding: 20,
              background: "#fff",
              boxShadow: "0 6px 18px rgba(0,0,0,0.06)",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 16,
                alignItems: "center",
                flexWrap: "wrap",
              }}
            >
              <div>
                <div style={{ fontSize: 24, fontWeight: 900 }}>
                  {sector.rankLabel} {sector.sectorName}
                </div>

                <div
                  style={{
                    marginTop: 4,
                    fontSize: 13,
                    color: "#666",
                  }}
                >
                  {sector.sectorKey}
                </div>
              </div>

              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 12, color: "#666" }}>
                  AI Score
                </div>
                <div style={{ fontSize: 34, fontWeight: 900 }}>
                  {sector.aiScore}
                </div>
              </div>
            </div>

            <div
              style={{
                marginTop: 14,
                height: 12,
                borderRadius: 999,
                background: "#e5e7eb",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  width: `${Math.max(
                    0,
                    Math.min(sector.aiScore, 100)
                  )}%`,
                  height: "100%",
                  background: "#111827",
                }}
              />
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns:
                  "repeat(auto-fit, minmax(140px, 1fr))",
                gap: 14,
                marginTop: 18,
              }}
            >
              <div>
                <div style={{ fontSize: 12, color: "#666" }}>
                  資金循環
                </div>
                <div style={{ fontSize: 18, fontWeight: 800 }}>
                  {sector.flowLabel}
                </div>
              </div>

              <div>
                <div style={{ fontSize: 12, color: "#666" }}>
                  勝率
                </div>
                <div style={{ fontSize: 18, fontWeight: 800 }}>
                  {sector.winRate}%
                </div>
              </div>

              <div>
                <div style={{ fontSize: 12, color: "#666" }}>
                  AI BONUS
                </div>
                <div style={{ fontSize: 18, fontWeight: 800 }}>
                  {getBonusText(sector.aiBonus)}
                </div>
              </div>

              <div>
                <div style={{ fontSize: 12, color: "#666" }}>
                  Confidence
                </div>
                <div style={{ fontSize: 18, fontWeight: 800 }}>
                  {sector.confidence}%
                </div>
              </div>

              <div>
                <div style={{ fontSize: 12, color: "#666" }}>
                  学習件数
                </div>
                <div style={{ fontSize: 18, fontWeight: 800 }}>
                  {sector.total}
                </div>
              </div>
            </div>
          </div>
        ))}
      </section>
    </main>
  );
}