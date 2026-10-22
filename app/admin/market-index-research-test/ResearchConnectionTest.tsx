"use client";

import { useState } from "react";

type Result = { success?: boolean; mode?: string; recordsFound?: number; writeTestPerformed?: boolean; writeVerified?: boolean; rollbackVerified?: boolean; failureCategory?: string; reason?: string; persistedRows?: number };

export default function ResearchConnectionTest() {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState("");
  async function runTest(saveStatus = false) {
    setBusy(true);
    setError("");
    setResult(null);
    try {
      const response = await fetch("/api/admin/market-index-research", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Accept": "application/json", "Content-Type": "application/json" },
        body: JSON.stringify({ action: saveStatus ? "save-unavailable-status" : "rollback-test" }),
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
      <button type="button" onClick={() => runTest()} disabled={busy}
        style={{ padding: "12px 20px", borderRadius: 8, background: "#174ea6", color: "white", cursor: busy ? "wait" : "pointer" }}>
        {busy ? "確認中…" : "書き込み・取り消しテストを実行"}
      </button>
      <section style={{ marginTop: 28, padding: 16, border: "1px solid #aaa", borderRadius: 8 }}>
        <h2>次の研究記録・保存前プレビュー</h2>
        <p>対象：日経平均（nikkei）</p>
        <p>提供元：許諾確認待ち</p>
        <p>取得状態：unavailable（取得不可）</p>
        <p>理由：PROVIDER_APPROVAL_REQUIRED</p>
        <p>指数値：保存しない / 自動収集：無効</p>
        <p>以下のボタンを押した場合のみ、開発用DBに1件保存します。</p>
        <button type="button" onClick={() => runTest(true)} disabled={busy}
          style={{ padding: "12px 20px", borderRadius: 8, background: "#365a44", color: "white" }}>
          {busy ? "処理中…" : "取得不可の研究記録を1件保存"}
        </button>
      </section>
      {error && <p role="alert" style={{ color: "#b91c1c" }}>{error}</p>}
      {result && <section aria-live="polite" style={{ marginTop: 24 }}>
        <h2>{result.success ? "接続テスト成功" : "接続テスト未成功"}</h2>
        <p>方式：{result.mode ?? "不明"}</p>
        {result.mode !== "PREVIEW_UNAVAILABLE_STATUS_SAVED" && <p>テスト書き込み：{result.writeVerified ? "成功" : "未確認"}</p>}
        {result.mode === "PREVIEW_UNAVAILABLE_STATUS_SAVED"
          ? <p>研究記録：{result.success && result.persistedRows === 1 ? "保存成功（1件）" : "保存未確認"}</p>
          : <p>取り消し確認：{result.rollbackVerified ? "成功（データは残りません）" : "未確認"}</p>}
        {result.failureCategory && <p>原因分類：{result.failureCategory}</p>}
        {result.reason && <p>理由：{result.reason}</p>}
      </section>}
    </main>
  );
}
