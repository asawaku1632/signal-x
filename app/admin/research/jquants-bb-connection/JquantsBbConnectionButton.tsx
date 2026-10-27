"use client";

import { useState } from "react";

type ProbeResult = {
  success?: boolean;
  reason?: string;
  counts?: Record<string, number>;
  licenseReview?: string;
  saved?: boolean;
  productionWrites?: boolean;
  total?: number;
  matched?: number;
  differed?: number;
  blocked?: number;
  details?: {code:string; observationDate:string; status:string; reason?:string|null}[];
};

export default function JquantsBbConnectionButton() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ProbeResult | null>(null);
  const [comparison, setComparison] = useState<ProbeResult | null>(null);
  const [comparing, setComparing] = useState(false);
  const [saving,setSaving]=useState(false);
  const [saveResult,setSaveResult]=useState("");
  const [history,setHistory]=useState<{id:number;checked_at:string;total_count:number;matched_count:number;differed_count:number;blocked_count:number;unique_pairs:number}[]>([]);
  async function loadHistory(){try{const r=await fetch("/api/admin/research/jquants-bb-history",{cache:"no-store"});const j=await r.json();setHistory(j.success?j.history:[]);if(!j.success)setSaveResult("履歴取得不可: "+j.reason);}catch{setSaveResult("履歴取得に失敗");}}
  async function saveAudit(){if(saving)return;setSaving(true);setSaveResult("");try{const r=await fetch("/api/admin/research/jquants-bb-history",{method:"POST",headers:{"Content-Type":"application/json"},credentials:"same-origin",body:JSON.stringify({confirm:"SAVE_BB_JQUANTS_RESEARCH_AUDIT"})});const j=await r.json();setSaveResult(j.success?"研究履歴を保存しました（ID: "+j.id+"）":"保存不可: "+j.reason);if(j.success)await loadHistory();}catch{setSaveResult("保存通信エラー");}finally{setSaving(false);}}
  async function compare() {
    if (comparing) return;
    setComparing(true);
    setComparison(null);
    try {
      const response = await fetch("/api/admin/research/jquants-bb-compare", {
        method: "POST", headers: {"Content-Type":"application/json"},
        credentials:"same-origin", cache:"no-store",
        body: JSON.stringify({confirm:"JQUANTS_BB_COMPARE_READ_ONLY"}),
      });
      setComparison(await response.json());
    } catch { setComparison({success:false,reason:"NETWORK_OR_RESPONSE_ERROR"}); }
    finally { setComparing(false); }
  }
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
      <hr style={{margin:"24px 0"}} />
      <h2>BB保存結果とJ-Quants終値の照合（研究専用）</h2>
      <p>開発DBから確認した固定6件を使用。実行時にDBは読み書きせず、価格は表示・保存しません。</p>
      <button type="button" onClick={compare} disabled={comparing}
        style={{padding:"12px 18px",border:"1px solid currentColor",borderRadius:8}}>
        {comparing ? "照合中…" : "読み取り専用で価格を照合する"}
      </button>
      {comparison && <div role="status" aria-live="polite" style={{marginTop:16}}>
        {comparison.success ? <>
          <p>照合完了（本番AIへの反映なし）</p>
          <p>対象: {comparison.total}件 ／ 一致: {comparison.matched}件 ／ 差異: {comparison.differed}件 ／ 判定不能: {comparison.blocked}件</p>
          <ul>{comparison.details?.map((item,i)=><li key={i}>{item.code}（{item.observationDate}）: {item.status}{item.reason ? ` / ${item.reason}` : ""}</li>)}</ul>
          <p>価格調整方式・商用利用条件は未検証。売買成績の証明ではありません。</p>
        </> : <p>照合できませんでした: {comparison.reason ?? "UNKNOWN_ERROR"}</p>}
      </div>}
      <hr style={{margin:"24px 0"}} />
      <h2>価格照合の研究履歴</h2>
      <p>価格照合とは別操作です。保存時はJ-Quantsを再取得・再照合し、件数と判定結果だけを開発DBに記録します。株価・APIキー・本番AIは保存・変更しません。</p>
      <button type="button" disabled={saving} onClick={saveAudit} style={{padding:"12px 18px",border:"1px solid currentColor",borderRadius:8}}>{saving?"保存中…":"再照合して研究履歴に保存する"}</button>
      <button type="button" onClick={loadHistory} style={{padding:"12px 18px",marginLeft:8,border:"1px solid currentColor",borderRadius:8}}>保存履歴を表示</button>
      {saveResult&&<p role="status">{saveResult}</p>}
      <ul>{history.map(h=><li key={h.id}>{new Date(h.checked_at).toLocaleString("ja-JP",{timeZone:"Asia/Tokyo"})}｜一致 {h.matched_count}/{h.total_count}・差異 {h.differed_count}・判定不能 {h.blocked_count}（独立組 {h.unique_pairs}）</li>)}</ul>
    </section>
  );
}
