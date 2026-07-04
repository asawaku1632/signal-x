type EventRanking = {
  rank: number;
  rankLabel: string;
  eventType: string;
  eventLabel: string;
  total: number;
  judged: number;
  win: number;
  lose: number;
  hold: number;
  pending: number;
  winRate: number;
  aiBonus: number;
  confidence: number;
  averageAiPower: number;
};

async function getEventAnalytics() {
  const baseUrl =
    process.env.NEXTAUTH_URL || "http://localhost:3000";

  const res = await fetch(
    `${baseUrl}/api/event-learning/analytics`,
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

function getEventEmoji(eventType: string) {
  switch (eventType) {
    case "EARNINGS":
      return "📊";
    case "SHAREHOLDER_RETURN":
      return "💰";
    case "NEWS":
      return "📰";
    case "TECHNICAL_EVENT":
      return "📈";
    default:
      return "⚪";
  }
}

export default async function EventRankingPage() {
  const data = await getEventAnalytics();
  const ranking: EventRanking[] = data.ranking ?? [];

  return (
    <main style={{ padding: 24, maxWidth: 1100, margin: "0 auto" }}>
      <h1 style={{ fontSize: 28, fontWeight: 900 }}>
        📢 Event Ranking AI
      </h1>

      <p style={{ color: "#666", marginTop: 8 }}>
        V13.11 / イベント別の勝率・AI BONUS・Confidenceをランキング表示
      </p>

      <section style={{ marginTop: 24, display: "grid", gap: 14 }}>
        {ranking.map((item) => (
          <div
            key={item.eventType}
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
                  {item.rankLabel} {getEventEmoji(item.eventType)}{" "}
                  {item.eventLabel}
                </div>

                <div style={{ marginTop: 4, fontSize: 13, color: "#666" }}>
                  {item.eventType}
                </div>
              </div>

              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 12, color: "#666" }}>勝率</div>
                <div style={{ fontSize: 34, fontWeight: 900 }}>
                  {item.winRate}%
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
                  width: barWidth(item.winRate),
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
                <div style={{ fontSize: 12, color: "#666" }}>
                  平均AI POWER
                </div>
                <div style={{ fontSize: 20, fontWeight: 800 }}>
                  {item.averageAiPower}
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
              WIN {item.win} / LOSE {item.lose} / HOLD {item.hold} / PENDING{" "}
              {item.pending}
            </div>
          </div>
        ))}
      </section>
    </main>
  );
}