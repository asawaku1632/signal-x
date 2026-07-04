type TimeSlot = {
  rank: number;
  rankLabel: string;
  timeSlot: string;
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

async function getTimeAnalytics() {
  const baseUrl =
    process.env.NEXTAUTH_URL || "http://localhost:3000";

  const res = await fetch(
    `${baseUrl}/api/time-learning/analytics`,
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

export default async function TimeRankingPage() {
  const data = await getTimeAnalytics();
  const timeSlots: TimeSlot[] = data.timeSlots ?? [];

  return (
    <main style={{ padding: 24, maxWidth: 1100, margin: "0 auto" }}>
      <h1 style={{ fontSize: 28, fontWeight: 900 }}>
        ⏰ Time Ranking AI
      </h1>

      <p style={{ color: "#666", marginTop: 8 }}>
        V13.9 / 時間帯別の勝率・AI BONUS・Confidenceをランキング表示
      </p>

      <section style={{ marginTop: 24, display: "grid", gap: 14 }}>
        {timeSlots.map((slot) => (
          <div
            key={slot.timeSlot}
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
                  {slot.rankLabel} {slot.timeSlot}
                </div>

                <div style={{ marginTop: 4, fontSize: 13, color: "#666" }}>
                  時間帯学習データ
                </div>
              </div>

              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 12, color: "#666" }}>
                  勝率
                </div>
                <div style={{ fontSize: 34, fontWeight: 900 }}>
                  {slot.winRate}%
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
                  width: barWidth(slot.winRate),
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
                  {getBonusText(slot.aiBonus)}
                </div>
              </div>

              <div>
                <div style={{ fontSize: 12, color: "#666" }}>
                  Confidence
                </div>
                <div style={{ fontSize: 20, fontWeight: 800 }}>
                  {slot.confidence}%
                </div>
              </div>

              <div>
                <div style={{ fontSize: 12, color: "#666" }}>
                  平均AI POWER
                </div>
                <div style={{ fontSize: 20, fontWeight: 800 }}>
                  {slot.averageAiPower}
                </div>
              </div>

              <div>
                <div style={{ fontSize: 12, color: "#666" }}>
                  判定済み
                </div>
                <div style={{ fontSize: 20, fontWeight: 800 }}>
                  {slot.judged}
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
              WIN {slot.win} / LOSE {slot.lose} / HOLD {slot.hold} / PENDING{" "}
              {slot.pending}
            </div>
          </div>
        ))}
      </section>
    </main>
  );
}