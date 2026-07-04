type MarketPatternData = {
  success: boolean;
  aiPowerVersion: string;
  marketPattern: string;
  label: string;
  emoji: string;
  summary: {
    total: number;
    averageAiPower: number;
    risingCount: number;
    fallingCount: number;
    neutralCount: number;
    strongCount: number;
    dangerCount: number;
    risingRate: number;
    fallingRate: number;
    strongRate: number;
    dangerRate: number;
  };
  source: {
    scanVersion: string;
    debugVersion: string;
    count: number;
    requestedLimit: number;
    totalStockList: number;
  };
  apiTimeMs: number;
};

async function getMarketPattern() {
  const baseUrl =
    process.env.NEXTAUTH_URL || "http://localhost:3000";

  const res = await fetch(`${baseUrl}/api/market/pattern`, {
    cache: "no-store",
  });

  return res.json();
}

function barWidth(value: number) {
  return `${Math.max(0, Math.min(value, 100))}%`;
}

export default async function MarketPatternPage() {
  const data: MarketPatternData = await getMarketPattern();
  const s = data.summary;

  return (
    <main style={{ padding: 24, maxWidth: 1100, margin: "0 auto" }}>
      <h1 style={{ fontSize: 28, fontWeight: 900 }}>
        {data.emoji} Market Pattern AI
      </h1>

      <p style={{ color: "#666", marginTop: 8 }}>
        V13.8 / 市場全体の強気・弱気・横ばいをAI判定
      </p>

      <section
        style={{
          marginTop: 24,
          border: "1px solid #e5e7eb",
          borderRadius: 20,
          padding: 24,
          background: "#fff",
          boxShadow: "0 6px 18px rgba(0,0,0,0.06)",
        }}
      >
        <div style={{ fontSize: 18, color: "#666" }}>
          現在の市場判定
        </div>

        <div style={{ fontSize: 42, fontWeight: 950, marginTop: 8 }}>
          {data.emoji} {data.label}
        </div>

        <div style={{ marginTop: 12, color: "#555" }}>
          Pattern: {data.marketPattern}
        </div>

        <div
          style={{
            marginTop: 20,
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: 16,
          }}
        >
          <div>
            <div style={{ fontSize: 12, color: "#666" }}>
              平均AI POWER
            </div>
            <div style={{ fontSize: 30, fontWeight: 900 }}>
              {s.averageAiPower}
            </div>
          </div>

          <div>
            <div style={{ fontSize: 12, color: "#666" }}>
              監視銘柄数
            </div>
            <div style={{ fontSize: 30, fontWeight: 900 }}>
              {s.total}
            </div>
          </div>

          <div>
            <div style={{ fontSize: 12, color: "#666" }}>
              強い銘柄
            </div>
            <div style={{ fontSize: 30, fontWeight: 900 }}>
              {s.strongCount}
            </div>
          </div>

          <div>
            <div style={{ fontSize: 12, color: "#666" }}>
              危険銘柄
            </div>
            <div style={{ fontSize: 30, fontWeight: 900 }}>
              {s.dangerCount}
            </div>
          </div>
        </div>
      </section>

      <section style={{ marginTop: 20, display: "grid", gap: 14 }}>
        {[
          {
            label: "上昇銘柄",
            count: s.risingCount,
            rate: s.risingRate,
          },
          {
            label: "下落銘柄",
            count: s.fallingCount,
            rate: s.fallingRate,
          },
          {
            label: "横ばい銘柄",
            count: s.neutralCount,
            rate: 100 - s.risingRate - s.fallingRate,
          },
          {
            label: "強い銘柄",
            count: s.strongCount,
            rate: s.strongRate,
          },
          {
            label: "危険銘柄",
            count: s.dangerCount,
            rate: s.dangerRate,
          },
        ].map((item) => (
          <div
            key={item.label}
            style={{
              border: "1px solid #e5e7eb",
              borderRadius: 16,
              padding: 18,
              background: "#fff",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontWeight: 800,
              }}
            >
              <span>{item.label}</span>
              <span>
                {item.count} / {item.rate.toFixed(1)}%
              </span>
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
                  width: barWidth(item.rate),
                  height: "100%",
                  background: "#111827",
                }}
              />
            </div>
          </div>
        ))}
      </section>

      <section style={{ marginTop: 24, color: "#666", fontSize: 13 }}>
        <div>AI Version: {data.aiPowerVersion}</div>
        <div>Scan Version: {data.source?.scanVersion}</div>
        <div>Debug: {data.source?.debugVersion}</div>
        <div>API Time: {data.apiTimeMs}ms</div>
      </section>
    </main>
  );
}