"use client";

import { useState } from "react";

type Result = { success?: boolean; mode?: string; recordsFound?: number; writeTestPerformed?: boolean; failureCategory?: string; reason?: string };

export default function ResearchConnectionTest() {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState("");
  async function runTest() {
    setBusy(true);
    setError("");
    setResult(null);
    try {
      const response = await fetch("/api/admin/market-index-research", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Accept": "application/json" },
        cache: "no-store",
      });
      const data: Result = await response.json();
      setResult(data);
      if (!response.ok) setError("接続テストが成功しませんでした。");
    } catch {
      setError("通信エラーが発生しました。");
    } finally {
      setBusy(false);
    }
  }
  return (
    <main style={{ maxWidth: 620, margin: "40px auto", padding: 24, fontFamily: "sans-serif" }}>
      <h1>研究用DB・接続テスト</h1>
      <p>管理者専用 / Preview環境。開発用DBの読み取りだけを検証します。書き込み・自動収集は行いません。</p>
      <button type="button" onClick={runTest} disabled={busy}
        style={{ padding: "12px 20px", borderRadius: 8, background: "#174ea6", color: "white", cursor: busy ? "wait" : "pointer" }}>
        {busy ? "確認中…" : "安全な接続テストを実行"}
      </button>
      {error && <p role="alert" style={{ color: "#b91c1c" }}>{error}</p>}
      {result && <section aria-live="polite" style={{ marginTop: 24 }}>
        <h2>{result.success ? "接続テスト成功" : "接続テスト未成功"}</h2>
        <p>方式：{result.mode ?? "不明"}</p>
        <p>読み取った履歴：{result.recordsFound ?? "不明"}件</p>
        <p>書き込みテスト：{result.writeTestPerformed ? "実施" : "未実施（読み取り専用）"}</p>
        {result.failureCategory && <p>原因分類：{result.failureCategory}</p>}
        {result.reason && <p>理由：{result.reason}</p>}
      </section>}
    </main>
  );
}
