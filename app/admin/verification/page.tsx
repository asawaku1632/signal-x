"use client";

import { useState } from "react";

type VerificationError = {
  code?: string;
  name?: string;
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

  requestedLimit?: number;
  totalStockList?: number | null;
  stockCount?: number;
  missingCount?: number;

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

  const runVerification = async () => {
    setLoading(true);
    setResult(null);

    try {
      const res = await fetch("/api/verification/run", {
        cache: "no-store",
      });

      const data = await res.json();
      setResult(data);
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

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#f3f4f6",
        padding: 24,
        color: "#111827",
      }}
    >
      <div
        style={{
          maxWidth: 960,
          margin: "0 auto",
        }}
      >
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
                  <td style={tdStyle}>1000銘柄取得</td>
                  <td style={tdStyle}>{result.stockCount ?? 0} / 1000</td>
                  <td style={tdStyle}>
                    {judgeLabel(result.stockCount === 1000)}
                  </td>
                </tr>

                <tr>
                  <td style={tdStyle}>未取得銘柄数</td>
                  <td style={tdStyle}>{result.missingCount ?? "-"}</td>
                  <td style={tdStyle}>
                    {judgeLabel((result.missingCount ?? 1) === 0)}
                  </td>
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
      </div>
    </main>
  );
}

const tdStyle: React.CSSProperties = {
  borderBottom: "1px solid #e5e7eb",
  padding: "10px 8px",
};