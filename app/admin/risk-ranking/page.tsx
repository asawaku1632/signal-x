type RiskRanking = {
  rank: number;
  rankLabel: string;
  riskBand: string;
  riskLabel: string;
  total: number;
  judged: number;
  win: number;
  lose: number;
  hold: number;
  winRate: number;
  takeProfitHit: number;
  stopLossHit: number;
  takeProfitRate: number;
  stopLossRate: number;
  averageRiskScore: number;
  averageAiPower: number;
  aiBonus: number;
  confidence: number;
};

async function getRiskAnalytics() {
  const baseUrl =
    process.env.NEXTAUTH_URL || "http://localhost:3000";

  const res = await fetch(
    `${baseUrl}/api/risk-learning/analytics`,
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

function barWidth(value: number) {
  return `${Math.max(0, Math.min(value, 100))}%`;
}

function getRiskEmoji(riskBand: string) {
  switch (riskBand) {
    case "RISK_SAFE":
      return "🟢";
    case "RISK_LOW":
      return "🟩";
    case "RISK_NORMAL":
      return "🟡";
    case "RISK_HIGH":
      return "🟧";
    case "RISK_EXTREME":
      return "🔴";
    default:
      return "⚪";
  }
}

export default async function RiskRankingPage() {
  const data = await getRiskAnalytics();
  const ranking: RiskRanking[] = data.ranking ?? [];

  return (
    <main style={{ padding: 24, maxWidth: 1100, margin: "0 auto" }}>
      <h1 style={{ fontSize: 28, fontWeight: 900 }}>
        🛡️ Risk Ranking AI
      </h1>

      <p style={{ color: "#666", marginTop: 8 }}>
        V13.13 / リスク帯別のRisk Score・利確率・損切率をランキング表示
      </p>

      <section style={{ marginTop: 24, display: "grid", gap: 14 }}>
        {ranking.map((item) => (
          <div
            key={item.riskBand}
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
                <div style={{ fontSize: 26, fontWeight: 900 }}>
                  {item.rankLabel} {getRiskEmoji(item.riskBand)}{" "}
                  {item.riskLabel}
                </div>

                <div style={{ marginTop: 4, fontSize: 13, color: "#666" }}>
                  {item.riskBand}
                </div>
              </div>

              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 12, color: "#666" }}>
                  平均Risk Score
                </div>
                <div style={{ fontSize: 34, fontWeight: 900 }}>
                  {item.averageRiskScore}
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
                  width: barWidth(item.averageRiskScore),
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
                <div style={{ fontSize: 12, color: "#666" }}>勝率</div>
                <div style={{ fontSize: 20, fontWeight: 800 }}>
                  {item.winRate}%
                </div>
              </div>

              <div>
                <div style={{ fontSize: 12, color: "#666" }}>利確率</div>
                <div style={{ fontSize: 20, fontWeight: 800 }}>
                  {item.takeProfitRate}%
                </div>
              </div>

              <div>
                <div style={{ fontSize: 12, color: "#666" }}>損切率</div>
                <div style={{ fontSize: 20, fontWeight: 800 }}>
                  {item.stopLossRate}%
                </div>
              </div>

              <div>
                <div style={{ fontSize: 12, color: "#666" }}>
                  平均AI POWER
                </div>
                <div style={{ fontSize: 20, fontWeight: 800 }}>
                  {item.averageAiPower}
                </div>
              </div>

              <div>
                <div style={{ fontSize: 12, color: "#666" }}>AI BONUS</div>
                <div style={{ fontSize: 20, fontWeight: 800 }}>
                  {getBonusText(item.aiBonus)}
                </div>
              </div>

              <div>
                <div style={{ fontSize: 12, color: "#666" }}>Confidence</div>
                <div style={{ fontSize: 20, fontWeight: 800 }}>
                  {item.confidence}%
                </div>
              </div>

              <div>
                <div style={{ fontSize: 12, color: "#666" }}>判定済み</div>
                <div style={{ fontSize: 20, fontWeight: 800 }}>
                  {item.judged}
                </div>
              </div>
            </div>

            <div style={{ marginTop: 14, fontSize: 13, color: "#555" }}>
              WIN {item.win} / LOSE {item.lose} / HOLD {item.hold} / 利確{" "}
              {item.takeProfitHit} / 損切 {item.stopLossHit}
            </div>
          </div>
        ))}
      </section>
    </main>
  );
}