"use client";

import { useState } from "react";

type ProbeResult = {
  success?: boolean;
  reason?: string;
  counts?: Record<string, number>;
  licenseReview?: string;
  saved?: boolean;
  productionWrites?: boolean;
};

export default function JquantsBbConnectionButton() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ProbeResult | null>(null);
  async function run() {
    if (loading) return;
    setLoading(true);
    setResult(null);
    try {
      const response = await fetch("/api/admin/research/jquants-bb-connection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        cache: "no-store",
        body: JSON.stringify({ confirm: "JQUANTS_RESEARCH_READ_ONLY" }),
      });
      const json: ProbeResult = await response.json();
      setResult(json);
    } catch {
      setResult({ success: false, reason: "NETWORK_OR_RESPONSE_ERROR" });
    } finally {
      setLoading(false);
    }
  }
  return (
    <section>
      <p>3銘柄（8591・9432・9983）の2026年8月24日〜9月4日の日足取得件数のみを確認します。</p>
      <p>研究専用・保存なし・本番AIへの反映なし。APIキーや株価は表示しません。</p>
      <button type="button" onClick={run} disabled={loading}
        style={{ padding: "12px 18px", border: "1px solid currentColor", borderRadius: 8 }}>
        {loading ? "接続確認中…" : "J-Quants接続を確認する"}
      </button>
      {result && <div role="status" aria-live="polite" style={{ marginTop: 16 }}>
        <p>{result.success ? "接続成功（価格の検証は未実施）" : "接続できませんでした"}</p>
        {result.reason && <p>理由: {result.reason}</p>}
        {result.counts && <ul>{Object.entries(result.counts).map(([code, count]) =>
          <li key={code}>{code}: {count}件</li>)}</ul>}
        <p>研究データの商用利用条件・価格基準は未検証です。</p>
      </div>}
    </section>
  );
}
