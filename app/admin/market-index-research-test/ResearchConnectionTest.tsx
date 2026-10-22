"use client";

import { useState } from "react";

type Result = { success?: boolean; mode?: string; recordsFound?: number; writeTestPerformed?: boolean; writeVerified?: boolean; rollbackVerified?: boolean; failureCategory?: string; reason?: string };

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
      <p>管理者専用 / Preview環境。架空のテスト記録を書き込み、直後に取り消す検証です。実際の指数データは保存せず、自動収集も行いません。</p>
      <button type="button" onClick={runTest} disabled={busy}
        style={{ padding: "12px 20px", borderRadius: 8, background: "#174ea6", color: "white", cursor: busy ? "wait" : "pointer" }}>
        {busy ? "確認中…" : "書き込み・取り消しテストを実行"}
      </button>
      {error && <p role="alert" style={{ color: "#b91c1c" }}>{error}</p>}
      {result && <section aria-live="polite" style={{ marginTop: 24 }}>
        <h2>{result.success ? "接続テスト成功" : "接続テスト未成功"}</h2>
        <p>方式：{result.mode ?? "不明"}</p>
        <p>テスト書き込み：{result.writeVerified ? "成功" : "未確認"}</p>
        <p>取り消し確認：{result.rollbackVerified ? "成功（データは残りません）" : "未確認"}</p>
        {result.failureCategory && <p>原因分類：{result.failureCategory}</p>}
        {result.reason && <p>理由：{result.reason}</p>}
      </section>}
    </main>
  );
}
