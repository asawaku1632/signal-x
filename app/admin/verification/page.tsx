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

function judgeLabel(ok: boolean) {
  return ok ? "PASS" : "FAIL";
}

function judgeColor(status?: string) {
  if (status === "PASS") return "#16a34a";
  if (status === "FAIL") return "#dc2626";
  return "#f97316";
}

export default function VerificationPage() {
  const [result, setResult] = useState<VerificationResult | null>(null);
  const [loading, setLoading] = useState(false);

  const [history, setHistory] = useState<any[]>([]);
  const [debugResult, setDebugResult] = useState<any>(null);
  const [technicalResult, setTechnicalResult] = useState<any>(null);

  const [aiPowerResult, setAiPowerResult] = useState<any>(null);
  const [aiPowerLoading, setAiPowerLoading] = useState(false);

  async function runAiPowerVerification() {
    setAiPowerLoading(true);

    try {
      const res = await fetch("/api/verification/ai-power", {
        cache: "no-store",
      });

      const data = await res.json();
      setAiPowerResult(data);
    } catch (error) {
      setAiPowerResult({
        success: false,
        status: "FAIL",
        error: "AI_POWER_VERIFICATION_FAILED",
      });
    } finally {
      setAiPowerLoading(false);
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

      const historyRes = await fetch("/api/verification/history", {
        cache: "no-store",
      });

      const historyData = await historyRes.json();
      setHistory(historyData.logs ?? []);

      const debugRes = await fetch("/api/verification/scan-debug?limit=1000", {
        cache: "no-store",
      });

      const debugData = await debugRes.json();
      setDebugResult(debugData);

      const technicalRes = await fetch("/api/verification/technical?limit=100", {
        cache: "no-store",
      });

      const technicalData = await technicalRes.json();
      setTechnicalResult(technicalData);
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

  const statusColor = judgeColor(result?.status);
  const aiPowerStatusColor = judgeColor(aiPowerResult?.status);

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#f3f4f6",
        padding: 24,
        color: "#111827",
      }}
    >
      <div style={{ maxWidth: 960, margin: "0 auto" }}>
        <header
          style={{
            background: "white",
            borderRadius: 16,
            padding: 24,
            boxShadow: "0 2px 10px rgba(0,0,0,0.06)",
            marginBottom: 20,
          }}
        >
          <h1 style={{ margin: 0 }}>SIGNALX Verification Center</h1>
          <p style={{ marginTop: 8, color: "#6b7280" }}>
            Google Play公開前 品質保証チェック
          </p>

          <button
            onClick={runVerification}
            disabled={loading}
            style={{
              marginTop: 16,
              padding: "12px 20px",
              borderRadius: 10,
              border: "none",
              background: loading ? "#6b7280" : "#111827",
              color: "white",
              fontWeight: "bold",
              cursor: loading ? "not-allowed" : "pointer",
            }}
          >
            {loading ? "検証中..." : "検証開始"}
          </button>

          <button
            onClick={runAiPowerVerification}
            disabled={aiPowerLoading}
            style={{
              marginTop: 16,
              marginLeft: 12,
              padding: "12px 20px",
              borderRadius: 10,
              border: "none",
              background: aiPowerLoading ? "#93c5fd" : "#2563eb",
              color: "white",
              fontWeight: "bold",
              cursor: aiPowerLoading ? "not-allowed" : "pointer",
            }}
          >
            {aiPowerLoading ? "AI POWER監査中..." : "AI POWER監査"}
          </button>
        </header>

        {result && (
          <section
            style={{
              background: "white",
              borderRadius: 16,
              padding: 24,
              boxShadow: "0 2px 10px rgba(0,0,0,0.06)",
            }}
          >
            <h2 style={{ color: statusColor, marginTop: 0 }}>
              総合判定：{result.status}
            </h2>

            {result.error && (
              <p style={{ color: "#dc2626", fontWeight: "bold" }}>
                エラー：{result.error}
              </p>
            )}

            <div style={{ lineHeight: 2 }}>
              <p>検証時刻：{result.checkedAt}</p>
              <p>Debug Version：{result.debugVersion ?? "-"}</p>
              <p>Scan成功：{String(result.scanSuccess)}</p>
              <p>Cache使用：{String(result.cached)}</p>
              <p>Fallback使用：{String(result.fallback)}</p>
            </div>

            <hr style={{ margin: "20px 0" }} />

            <h3>Phase1：データ取得検証</h3>

            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                marginTop: 12,
              }}
            >
              <tbody>
                <tr>
                  <td style={tdStyle}>要求銘柄数</td>
                  <td style={tdStyle}>{result.requestedLimit ?? "-"}</td>
                  <td style={tdStyle}>-</td>
                </tr>

                <tr>
                  <td style={tdStyle}>登録銘柄総数</td>
                  <td style={tdStyle}>{result.totalStockList ?? "-"}</td>
                  <td style={tdStyle}>-</td>
                </tr>

                <tr>
                  <td style={tdStyle}>対象銘柄取得率</td>
                  <td style={tdStyle}>
                    {result.stockCount ?? 0} / {result.totalStockList ?? 0}{" "}
                    (
                    {result.acquisitionRate
                      ? (result.acquisitionRate * 100).toFixed(2)
                      : "0.00"}
                    %)
                  </td>
                  <td style={tdStyle}>
                    {judgeLabel((result.acquisitionRate ?? 0) >= 0.99)}
                  </td>
                </tr>

                <tr>
                  <td style={tdStyle}>未取得銘柄数</td>
                  <td style={tdStyle}>{result.missingCount ?? "-"}</td>
                  <td style={tdStyle}>情報</td>
                </tr>

                <tr>
                  <td style={tdStyle}>除外候補</td>
                  <td style={tdStyle}>{(result as any).excludedCount ?? 0}</td>
                  <td style={tdStyle}>確認中</td>
                </tr>

                <tr>
                  <td style={tdStyle}>要調査銘柄</td>
                  <td style={tdStyle}>
                    {(result as any).investigationRequiredCount ?? 0}
                  </td>
                  <td style={tdStyle}>監視中</td>
                </tr>

                <tr>
                  <td style={tdStyle}>銘柄コード</td>
                  <td style={tdStyle}>
                    {result.validCode ?? 0} / {result.stockCount ?? 0}
                  </td>
                  <td style={tdStyle}>
                    {judgeLabel(result.validCode === result.stockCount)}
                  </td>
                </tr>

                <tr>
                  <td style={tdStyle}>銘柄名</td>
                  <td style={tdStyle}>
                    {result.validName ?? 0} / {result.stockCount ?? 0}
                  </td>
                  <td style={tdStyle}>
                    {judgeLabel(result.validName === result.stockCount)}
                  </td>
                </tr>

                <tr>
                  <td style={tdStyle}>現在価格</td>
                  <td style={tdStyle}>
                    {result.validPrice ?? 0} / {result.stockCount ?? 0}
                  </td>
                  <td style={tdStyle}>
                    {judgeLabel(result.validPrice === result.stockCount)}
                  </td>
                </tr>

                <tr>
                  <td style={tdStyle}>AI POWER</td>
                  <td style={tdStyle}>
                    {result.validScore ?? 0} / {result.stockCount ?? 0}
                  </td>
                  <td style={tdStyle}>
                    {judgeLabel(result.validScore === result.stockCount)}
                  </td>
                </tr>

                <tr>
                  <td style={tdStyle}>判定理由</td>
                  <td style={tdStyle}>
                    {result.validReason ?? 0} / {result.stockCount ?? 0}
                  </td>
                  <td style={tdStyle}>
                    {judgeLabel(result.validReason === result.stockCount)}
                  </td>
                </tr>

                <tr>
                  <td style={tdStyle}>エラー件数</td>
                  <td style={tdStyle}>{result.errorCount ?? 0}</td>
                  <td style={tdStyle}>
                    {judgeLabel((result.errorCount ?? 1) === 0)}
                  </td>
                </tr>
              </tbody>
            </table>
                        {debugResult?.reasonSummary && (
              <div
                style={{
                  marginTop: 24,
                  background: "#fff7ed",
                  border: "1px solid #fed7aa",
                  borderRadius: 12,
                  padding: 16,
                }}
              >
                <h3 style={{ marginTop: 0 }}>取得失敗の内訳</h3>

                <p>対象銘柄取得：{result.stockCount ?? 0}件</p>
                <p>有効銘柄総数：{result.totalStockList ?? 0}件</p>
                <p>
                  取得率：
                  {result.acquisitionRate
                    ? (result.acquisitionRate * 100).toFixed(2)
                    : "0.00"}
                  %
                </p>
                <p>未取得総数：{result.missingCount ?? 0}件</p>
                <p>除外候補：{(result as any).excludedCount ?? 0}件</p>
                <p>
                  要調査：
                  {(result as any).investigationRequiredCount ?? 0}件
                </p>
                <p>解析時間：{debugResult.scanMs}ms</p>

                <table
                  style={{
                    width: "100%",
                    borderCollapse: "collapse",
                    background: "white",
                    marginTop: 12,
                  }}
                >
                  <thead>
                    <tr>
                      <th style={thStyle}>原因</th>
                      <th style={thStyle}>件数</th>
                    </tr>
                  </thead>

                  <tbody>
                    {Object.entries(debugResult.reasonSummary).map(
                      ([reason, count]) => (
                        <tr key={reason}>
                          <td style={tdStyle}>{reason}</td>
                          <td style={tdStyle}>{String(count)}</td>
                        </tr>
                      )
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {debugResult?.failedStocks && (
              <div style={{ marginTop: 20 }}>
                <h4>取得失敗銘柄 詳細</h4>

                <table
                  style={{
                    width: "100%",
                    borderCollapse: "collapse",
                    background: "white",
                    marginTop: 12,
                  }}
                >
                  <thead>
                    <tr>
                      <th style={thStyle}>コード</th>
                      <th style={thStyle}>銘柄名</th>
                      <th style={thStyle}>原因</th>
                    </tr>
                  </thead>

                  <tbody>
                    {debugResult.failedStocks.map((stock: any) => (
                      <tr key={stock.code}>
                        <td style={tdStyle}>{stock.code}</td>
                        <td style={tdStyle}>{stock.name}</td>
                        <td style={tdStyle}>{stock.reason}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {result.missingStocks && result.missingStocks.length > 0 && (
              <div
                style={{
                  marginTop: 24,
                  background: "#fef2f2",
                  border: "1px solid #fecaca",
                  borderRadius: 12,
                  padding: 16,
                }}
              >
                <h3 style={{ color: "#dc2626", marginTop: 0 }}>
                  未取得銘柄一覧：{result.missingStocks.length}件
                </h3>

                <table
                  style={{
                    width: "100%",
                    borderCollapse: "collapse",
                    background: "white",
                  }}
                >
                  <thead>
                    <tr>
                      <th style={thStyle}>コード</th>
                      <th style={thStyle}>銘柄名</th>
                      <th style={thStyle}>理由</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.missingStocks.map((stock) => (
                      <tr key={stock.code}>
                        <td style={tdStyle}>{stock.code}</td>
                        <td style={tdStyle}>{stock.name}</td>
                        <td style={tdStyle}>{stock.reason}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {result.errors && result.errors.length > 0 && (
              <div style={{ marginTop: 24 }}>
                <h3>エラー詳細 最大100件</h3>
                <ul>
                  {result.errors.map((item, index) => (
                    <li key={index}>
                      {item.code || "UNKNOWN"}{" "}
                      {item.name ? `(${item.name})` : ""}：{item.reason}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>
        )}

        {technicalResult && (
          <section
            style={{
              background: "white",
              borderRadius: 16,
              padding: 24,
              marginTop: 24,
              boxShadow: "0 2px 10px rgba(0,0,0,0.06)",
            }}
          >
            <h2>Phase2：テクニカル検証</h2>

            <p>対象銘柄数：{technicalResult.targetCount}</p>
            <p>PASS：{technicalResult.passCount}</p>
            <p>FAIL：{technicalResult.failCount}</p>
            <p>一致率：{technicalResult.matchRate}%</p>
            <p>解析時間：{technicalResult.scanMs}ms</p>

            <h3>検証指標</h3>
            <p>{technicalResult.indicators?.join(" / ")}</p>
          </section>
        )}

        {aiPowerResult && (
          <section
            style={{
              background: "white",
              borderRadius: 16,
              padding: 24,
              marginTop: 24,
              boxShadow: "0 2px 10px rgba(0,0,0,0.06)",
            }}
          >
            <h2 style={{ color: aiPowerStatusColor, marginTop: 0 }}>
              Phase3：AI POWER監査：{aiPowerResult.status}
            </h2>

            {aiPowerResult.error && (
              <p style={{ color: "#dc2626", fontWeight: "bold" }}>
                エラー：{aiPowerResult.error}
              </p>
            )}

            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                marginTop: 12,
              }}
            >
              <tbody>
                <tr>
                  <td style={tdStyle}>検査銘柄</td>
                  <td style={tdStyle}>{aiPowerResult.checked ?? 0}</td>
                  <td style={tdStyle}>-</td>
                </tr>

                <tr>
                  <td style={tdStyle}>PASS</td>
                  <td style={tdStyle}>{aiPowerResult.pass ?? 0}</td>
                  <td style={tdStyle}>
                    {judgeLabel(aiPowerResult.status === "PASS")}
                  </td>
                </tr>

                <tr>
                  <td style={tdStyle}>FAIL</td>
                  <td style={tdStyle}>{aiPowerResult.fail ?? 0}</td>
                  <td style={tdStyle}>
                    {judgeLabel((aiPowerResult.fail ?? 1) === 0)}
                  </td>
                </tr>

                <tr>
                  <td style={tdStyle}>一致率</td>
                  <td style={tdStyle}>{aiPowerResult.passRate ?? 0}%</td>
                  <td style={tdStyle}>
                    {judgeLabel((aiPowerResult.passRate ?? 0) >= 99)}
                  </td>
                </tr>

                <tr>
                  <td style={tdStyle}>API時間</td>
                  <td style={tdStyle}>{aiPowerResult.apiTimeMs ?? "-"}ms</td>
                  <td style={tdStyle}>情報</td>
                </tr>
              </tbody>
            </table>

            {aiPowerResult.failedStocks?.length > 0 ? (
              <div
                style={{
                  marginTop: 24,
                  background: "#fef2f2",
                  border: "1px solid #fecaca",
                  borderRadius: 12,
                  padding: 16,
                }}
              >
                <h3 style={{ color: "#dc2626", marginTop: 0 }}>
                  AI POWER FAIL一覧：{aiPowerResult.failedStocks.length}件
                </h3>

                <table
                  style={{
                    width: "100%",
                    borderCollapse: "collapse",
                    background: "white",
                  }}
                >
                  <thead>
                    <tr>
                      <th style={thStyle}>コード</th>
                      <th style={thStyle}>銘柄名</th>
                      <th style={thStyle}>エラー</th>
                    </tr>
                  </thead>

                  <tbody>
                    {aiPowerResult.failedStocks.map((stock: any) => (
                      <tr key={stock.code}>
                        <td style={tdStyle}>{stock.code}</td>
                        <td style={tdStyle}>{stock.name}</td>
                        <td style={tdStyle}>{stock.errors?.join(" / ")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p
                style={{
                  marginTop: 20,
                  background: "#dcfce7",
                  color: "#166534",
                  borderRadius: 12,
                  padding: 16,
                  fontWeight: "bold",
                }}
              >
                ✅ AI POWER異常なし
              </p>
            )}
          </section>
        )}

        {history.length > 0 && (
          <section
            style={{
              background: "white",
              borderRadius: 16,
              padding: 24,
              marginTop: 24,
              boxShadow: "0 2px 10px rgba(0,0,0,0.06)",
            }}
          >
            <h2>Verification History</h2>

            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
              }}
            >
              <thead>
                <tr>
                  <th style={thStyle}>日時</th>
                  <th style={thStyle}>判定</th>
                  <th style={thStyle}>取得銘柄</th>
                  <th style={thStyle}>不足</th>
                  <th style={thStyle}>API(ms)</th>
                </tr>
              </thead>

              <tbody>
                {history.map((item) => (
                  <tr key={item.id}>
                    <td style={tdStyle}>
                      {new Date(item.created_at).toLocaleString("ja-JP")}
                    </td>

                    <td style={tdStyle}>{item.status}</td>

                    <td style={tdStyle}>{item.stock_count}</td>

                    <td style={tdStyle}>{item.missing_count}</td>

                    <td style={tdStyle}>{item.scan_ms}</td>
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