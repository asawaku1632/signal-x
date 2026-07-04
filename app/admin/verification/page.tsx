"use client";

import { useState } from "react";
import type { CSSProperties } from "react";

type VerificationError = {
  code?: string;
  name?: string;
  reason: string;
};

type MissingStock = {
  code: string;
  name: string;
  reason: string;
};

type VerificationResult = {
  success: boolean;
  status: "PASS" | "FAIL" | "ERROR";
  checkedAt?: string;
  scanSuccess?: boolean;
  cached?: boolean;
  fallback?: boolean;
  debugVersion?: string;
  acquisitionRate?: number;
  requestedLimit?: number;
  totalStockList?: number | null;
  stockCount?: number;
  missingCount?: number;
  missingStocks?: MissingStock[];
  validCode?: number;
  validName?: number;
  validPrice?: number;
  validScore?: number;
  validReason?: number;
  errorCount?: number;
  errors?: VerificationError[];
  error?: string;
};

function judgeColor(status?: string) {
  if (status === "PASS") return "#16a34a";
  if (status === "FAIL") return "#dc2626";
  if (status === "NO_DATA") return "#f97316";
  return "#f97316";
}

function recommendationColor(evaluation?: string) {
  if (evaluation === "STRONG_BUY") return "#16a34a";
  if (evaluation === "BUY") return "#22c55e";
  if (evaluation === "SLIGHT_BUY") return "#84cc16";
  if (evaluation === "KEEP") return "#f97316";
  if (evaluation === "WEAK") return "#fb923c";
  if (evaluation === "AVOID") return "#dc2626";
  if (evaluation === "NOT_ENOUGH_DATA") return "#6b7280";
  return "#6b7280";
}

export default function VerificationPage() {
  const [result, setResult] = useState<VerificationResult | null>(null);
  const [loading, setLoading] = useState(false);

  const [technicalResult, setTechnicalResult] = useState<any>(null);

  const [aiPowerResult, setAiPowerResult] = useState<any>(null);
  const [aiPowerLoading, setAiPowerLoading] = useState(false);

  const [learningResult, setLearningResult] = useState<any>(null);
  const [learningLoading, setLearningLoading] = useState(false);

  const [lineResult, setLineResult] = useState<any>(null);
  const [lineLoading, setLineLoading] = useState(false);

  const [recommendations, setRecommendations] = useState<any[]>([]);
  const [evolutionHistory, setEvolutionHistory] = useState<any[]>([]);
  const [dailyReports, setDailyReports] = useState<any[]>([]);

  async function runAiPowerVerification() {
    setAiPowerLoading(true);

    try {
      const res = await fetch("/api/verification/ai-power", {
        cache: "no-store",
      });

      const data = await res.json();
      setAiPowerResult(data);
    } catch {
      setAiPowerResult({
        success: false,
        status: "FAIL",
        error: "AI_POWER_VERIFICATION_FAILED",
      });
    } finally {
      setAiPowerLoading(false);
    }
  }

  async function runLearningVerification() {
    setLearningLoading(true);

    try {
      const res = await fetch("/api/verification/learning", {
        cache: "no-store",
      });

      const data = await res.json();
      setLearningResult(data);
    } catch {
      setLearningResult({
        success: false,
        status: "FAIL",
        error: "LEARNING_VERIFICATION_FAILED",
      });
    } finally {
      setLearningLoading(false);
    }
  }

  async function runLineVerification() {
    setLineLoading(true);

    try {
      const res = await fetch("/api/verification/line", {
        cache: "no-store",
      });

      const data = await res.json();
      setLineResult(data);
    } catch {
      setLineResult({
        success: false,
        status: "FAIL",
        error: "LINE_VERIFICATION_FAILED",
      });
    } finally {
      setLineLoading(false);
    }
  }
    const runVerification = async () => {
    setLoading(true);
    setResult(null);

    try {
      const res = await fetch("/api/verification/run", {
        cache: "no-store",
      });

      const data = await res.json();
      setResult(data);

      const technicalRes = await fetch("/api/verification/technical?limit=100", {
        cache: "no-store",
      });

      const technicalData = await technicalRes.json();
      setTechnicalResult(technicalData);

      const recommendationRes = await fetch(
        "/api/ai-power/recommendations/list",
        { cache: "no-store" }
      );

      const recommendationData = await recommendationRes.json();
      setRecommendations(recommendationData.recommendations ?? []);

      const evolutionRes = await fetch("/api/ai-power/evolution-history", {
        cache: "no-store",
      });

      const evolutionData = await evolutionRes.json();
      setEvolutionHistory(evolutionData.history ?? []);

      const reportRes = await fetch("/api/ai-power/daily-report/history", {
        cache: "no-store",
      });

      const reportData = await reportRes.json();
      setDailyReports(reportData.history ?? []);
    } catch (error) {
      setResult({
        success: false,
        status: "ERROR",
        error: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setLoading(false);
    }
  };

  const phase1Ok = result?.status === "PASS";
  const phase2Ok =
    technicalResult?.status === "PASS" ||
    technicalResult?.failCount === 0 ||
    technicalResult?.matchRate >= 99;
  const phase3Ok = aiPowerResult?.status === "PASS";
  const phase4Ok = learningResult?.status === "PASS";
  const phase5Ok =
    lineResult?.status === "PASS" || lineResult?.status === "NO_DATA";
  const phase6Ok = recommendations.length > 0;
  const phase7Ok = evolutionHistory.length > 0;
  const phase8Ok = dailyReports.length > 0;

  const allRequiredOk =
    phase1Ok &&
    phase2Ok &&
    phase3Ok &&
    phase4Ok &&
    phase5Ok &&
    phase6Ok &&
    phase7Ok &&
    phase8Ok;

  const hasAnyFail =
    result?.status === "FAIL" ||
    result?.status === "ERROR" ||
    technicalResult?.status === "FAIL" ||
    aiPowerResult?.status === "FAIL" ||
    learningResult?.status === "FAIL" ||
    lineResult?.status === "FAIL";

  const qaStatus = hasAnyFail
    ? "🔴 NOT READY"
    : allRequiredOk
    ? "🟢 READY FOR RELEASE"
    : "🟡 CHECKING";

  const qaStatusColor = hasAnyFail
    ? "#dc2626"
    : qaStatus.includes("READY")
    ? "#16a34a"
    : "#f97316";

  const latestReport = dailyReports[dailyReports.length - 1];

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#f3f4f6",
        padding: 24,
        color: "#111827",
      }}
    >
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <header style={cardStyle}>
          <h1 style={{ margin: 0 }}>SIGNALX Verification Center</h1>
          <p style={{ marginTop: 8, color: "#6b7280" }}>
            Google Play公開前 品質保証チェック
          </p>

          <button
            onClick={runVerification}
            disabled={loading}
            style={{
              ...buttonStyle,
              background: loading ? "#6b7280" : "#111827",
            }}
          >
            {loading ? "検証中..." : "検証開始"}
          </button>

          <button
            onClick={runAiPowerVerification}
            disabled={aiPowerLoading}
            style={{
              ...buttonStyle,
              marginLeft: 12,
              background: aiPowerLoading ? "#93c5fd" : "#2563eb",
            }}
          >
            {aiPowerLoading ? "AI POWER監査中..." : "AI POWER監査"}
          </button>

          <button
            onClick={runLearningVerification}
            disabled={learningLoading}
            style={{
              ...buttonStyle,
              marginLeft: 12,
              background: learningLoading ? "#86efac" : "#16a34a",
            }}
          >
            {learningLoading ? "AI学習監査中..." : "AI学習監査"}
          </button>

          <button
            onClick={runLineVerification}
            disabled={lineLoading}
            style={{
              ...buttonStyle,
              marginLeft: 12,
              background: lineLoading ? "#86efac" : "#06c755",
            }}
          >
            {lineLoading ? "LINE監査中..." : "LINE通知監査"}
          </button>
        </header>

        <section
          style={{
            ...cardStyle,
            border: "2px solid #16a34a",
          }}
        >
          <h2 style={{ marginTop: 0 }}>SIGNALX QA STATUS</h2>

          <h1 style={{ color: qaStatusColor, margin: "8px 0" }}>
            {qaStatus}
          </h1>

          <p style={{ color: "#6b7280", marginTop: 8 }}>
            Google Play公開前 品質保証フェーズ
          </p>

          <div style={{ lineHeight: 2, marginTop: 16 }}>
            <p>{phase1Ok ? "✅" : "⏳"} Phase1：データ取得監査</p>
            <p>{phase2Ok ? "✅" : "⏳"} Phase2：テクニカル監査</p>
            <p>{phase3Ok ? "✅" : "⏳"} Phase3：AI POWER監査</p>
            <p>{phase4Ok ? "✅" : "⏳"} Phase4：AI学習監査</p>
            <p>
              {lineResult?.status === "NO_DATA" ? "🟠" : phase5Ok ? "✅" : "⏳"}{" "}
              Phase5：LINE通知監査
              {lineResult?.status === "NO_DATA"
                ? "（通知なし日はNO_DATA）"
                : ""}
            </p>
            <p>{phase6Ok ? "✅" : "⏳"} Phase6：AI提案監査</p>
            <p>{phase7Ok ? "✅" : "⏳"} Phase7：AI進化履歴</p>
            <p>{phase8Ok ? "✅" : "⏳"} Phase8：AI日次レポート</p>
          </div>
        </section>
              {evolutionHistory.length > 0 && (
        <section style={cardStyle}>
          <h2>🧠 AI Evolution History</h2>

          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>日時</th>
                <th style={thStyle}>種類</th>
                <th style={thStyle}>ルール</th>
                <th style={thStyle}>変更</th>
                <th style={thStyle}>勝率</th>
                <th style={thStyle}>件数</th>
              </tr>
            </thead>

            <tbody>
              {evolutionHistory.map((item) => (
                <tr key={item.id}>
                  <td style={tdStyle}>
                    {new Date(item.applied_at).toLocaleString("ja-JP")}
                  </td>
                  <td style={tdStyle}>{item.rule_type}</td>
                  <td style={tdStyle}>{item.rule_key}</td>
                  <td style={tdStyle}>
                    {item.old_bonus} → {item.new_bonus}
                  </td>
                  <td style={tdStyle}>{item.win_rate}%</td>
                  <td style={tdStyle}>{item.sample_count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {recommendations.length > 0 && (
        <section style={cardStyle}>
          <h2>🤖 Phase6：AI Recommendation</h2>

          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>項目</th>
                <th style={thStyle}>現在</th>
                <th style={thStyle}>AI提案</th>
                <th style={thStyle}>勝率</th>
                <th style={thStyle}>件数</th>
                <th style={thStyle}>評価</th>
              </tr>
            </thead>

            <tbody>
              {recommendations.map((item) => (
                <tr key={item.id}>
                  <td style={tdStyle}>{item.pattern_key}</td>
                  <td style={tdStyle}>{item.current_bonus}</td>

                  <td
                    style={{
                      ...tdStyle,
                      color:
                        item.recommended_bonus > 0
                          ? "#16a34a"
                          : item.recommended_bonus < 0
                          ? "#dc2626"
                          : "#6b7280",
                      fontWeight: "bold",
                    }}
                  >
                    {item.recommended_bonus > 0 ? "+" : ""}
                    {item.recommended_bonus}
                  </td>

                  <td style={tdStyle}>{item.win_rate}%</td>
                  <td style={tdStyle}>{item.sample_count}</td>

                  <td
                    style={{
                      ...tdStyle,
                      color: recommendationColor(item.evaluation),
                      fontWeight: "bold",
                    }}
                  >
                    {item.evaluation}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {latestReport && (
        <section style={cardStyle}>
          <h2>📈 AI Daily Report</h2>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(4,1fr)",
              gap: 16,
              marginBottom: 20,
            }}
          >
            <div style={statCard}>
              <h3>🤖 Health</h3>
              <h1>{latestReport.health_score}</h1>
            </div>

            <div style={statCard}>
              <h3>📊 Acquisition</h3>
              <h1>{latestReport.acquisition_rate}%</h1>
            </div>

            <div style={statCard}>
              <h3>🧠 Evolution</h3>
              <h1>{latestReport.evolution_count}</h1>
            </div>

            <div style={statCard}>
              <h3>✅ QA</h3>
              <h1>{latestReport.qa_status}</h1>
            </div>
          </div>

          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>日付</th>
                <th style={thStyle}>Health</th>
                <th style={thStyle}>取得率</th>
                <th style={thStyle}>提案</th>
                <th style={thStyle}>反映</th>
                <th style={thStyle}>進化</th>
              </tr>
            </thead>

            <tbody>
              {dailyReports.map((r) => (
                <tr key={r.id}>
                  <td style={tdStyle}>
                    {new Date(r.report_date).toLocaleDateString("ja-JP")}
                  </td>
                  <td style={tdStyle}>{r.health_score}</td>
                  <td style={tdStyle}>{r.acquisition_rate}%</td>
                  <td style={tdStyle}>
                    {r.generated_recommendations}
                  </td>
                  <td style={tdStyle}>
                    {r.applied_recommendations}
                  </td>
                  <td style={tdStyle}>{r.evolution_count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </div>
  </main>
);
}

const cardStyle: CSSProperties = {
  background: "#fff",
  borderRadius: 16,
  padding: 24,
  marginBottom: 20,
  boxShadow: "0 2px 10px rgba(0,0,0,.06)",
};

const statCard: CSSProperties = {
  background: "#f8fafc",
  borderRadius: 12,
  padding: 20,
  textAlign: "center",
};

const buttonStyle: CSSProperties = {
  marginTop: 16,
  padding: "12px 20px",
  borderRadius: 10,
  border: "none",
  color: "#fff",
  fontWeight: "bold",
  cursor: "pointer",
};

const tableStyle: CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
  marginTop: 16,
};

const tdStyle: CSSProperties = {
  borderBottom: "1px solid #e5e7eb",
  padding: "10px 8px",
};

const thStyle: CSSProperties = {
  borderBottom: "1px solid #e5e7eb",
  padding: "10px 8px",
  textAlign: "left",
  background: "#f9fafb",
};