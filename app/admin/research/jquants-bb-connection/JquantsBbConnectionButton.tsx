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
  const [eightLoading,setEightLoading]=useState(false);
  const [eightResult,setEightResult]=useState<{success?:boolean;reason?:string;results?:{code:string;status:string;side:string;savedPrice:number;referenceClose:number|null;difference:number|null;result:string}[]}|null>(null);
  async function compareEight(){if(eightLoading)return;setEightLoading(true);setEightResult(null);try{const r=await fetch("/api/admin/research/jquants-bb-eight-compare",{method:"POST",headers:{"Content-Type":"application/json"},credentials:"same-origin",cache:"no-store",body:JSON.stringify({confirm:"READ_ONLY_BB_EIGHT_PRICE_COMPARISON"})});setEightResult(await r.json());}catch{setEightResult({success:false,reason:"NETWORK_OR_RESPONSE_ERROR"});}finally{setEightLoading(false);}}
  const [batchLoading,setBatchLoading]=useState(false);
  const [batchResult,setBatchResult]=useState<{success?:boolean;reason?:string;batch?:number;total?:number;summary?:{compared:number;matched:number;differed:number;unavailable:number};results?:{code:string;status:string;side:string;savedPrice:number;referenceClose:number|null;difference:number|null;result:string}[]}|null>(null);
  async function compareBatch(){if(batchLoading)return;setBatchLoading(true);setBatchResult(null);try{const r=await fetch("/api/admin/research/jquants-bb-batch-compare",{method:"POST",headers:{"Content-Type":"application/json"},credentials:"same-origin",cache:"no-store",body:JSON.stringify({confirm:"READ_ONLY_BB_25_PRICE_COMPARISON",batch:0})});setBatchResult(await r.json());}catch{setBatchResult({success:false,reason:"NETWORK_OR_RESPONSE_ERROR"});}finally{setBatchLoading(false);}}
  const [result, setResult] = useState<ProbeResult | null>(null);
  const [comparison, setComparison] = useState<ProbeResult | null>(null);
  const [comparing, setComparing] = useState(false);
  const [saving,setSaving]=useState(false);
  const [saveResult,setSaveResult]=useState("");
  const [historyAnalysis,setHistoryAnalysis]=useState<{runsInWindow:number;distinctSnapshots:number;changedSincePreviousRun:boolean;independentEvidenceGrowth:boolean;eligibleForProduction:boolean;assessment:string}|null>(null);
  const [history,setHistory]=useState<{id:number;checked_at:string;total_count:number;matched_count:number;differed_count:number;blocked_count:number;unique_pairs:number}[]>([]);
  async function loadHistory(){try{const r=await fetch("/api/admin/research/jquants-bb-history",{cache:"no-store"});const j=await r.json();setHistory(j.success?j.history:[]);setHistoryAnalysis(j.success?j.analysis:null);if(!j.success)setSaveResult("履歴取得不可: "+j.reason);}catch{setSaveResult("履歴取得に失敗");}}
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
      <h2>8銘柄の保存価格とJ-Quants終値の比較</h2>
      <p>2026年8月10日の研究候補8銘柄を開発DBから読み取り、J-Quants V2の非調整終値と比較します。価格基準・利用条件は未検証。保存・本番反映なし。</p>
      <button type="button" onClick={compareEight} disabled={eightLoading} style={{padding:"12px 18px",border:"1px solid currentColor",borderRadius:8}}>{eightLoading?"8銘柄を照合中…":"8銘柄を読み取り専用で照合する"}</button>
      {eightResult&&<div role="status" aria-live="polite" style={{marginTop:16}}>{eightResult.success?<><p>研究用の価格差額（保存価格 − J-Quants終値）</p><div style={{overflowX:"auto"}}><table><thead><tr><th>銘柄</th><th>判定</th><th>保存価格</th><th>参考終値</th><th>差額</th><th>取得結果</th></tr></thead><tbody>{eightResult.results?.map(x=><tr key={x.code}><td>{x.code}</td><td>{x.status} / {x.side}</td><td>{x.savedPrice}</td><td>{x.referenceClose??"未取得"}</td><td>{x.difference??"—"}</td><td>{x.result}</td></tr>)}</tbody></table></div><p>差額0でも売買価格・学習性能の妥当性を証明するものではありません。本番AIへの反映は不可。</p></>:<p>照合不可: {eightResult.reason??"UNKNOWN_ERROR"}</p>}</div>}
      <hr style={{margin:"24px 0"}} />
      <hr style={{margin:"24px 0"}} />
      <h2>419件の価格監査：第1バッチ（25銘柄）</h2>
      <p>2026年8月10日の419件を銘柄コード順に25件ずつ照合します。まず第1バッチのみ実行します。開発DB読み取り専用・価格基準と商用利用条件は未確認・本番反映なし。</p>
      <button type="button" onClick={compareBatch} disabled={batchLoading} style={{padding:"12px 18px",border:"1px solid currentColor",borderRadius:8}}>{batchLoading?"第1バッチを照合中…":"第1バッチ25銘柄を照合する"}</button>
      {batchResult&&<div role="status" aria-live="polite" style={{marginTop:16}}>{batchResult.success?<><p>第1バッチ結果：一致 {batchResult.summary?.matched}件 ／ 差異 {batchResult.summary?.differed}件 ／ 取得不能 {batchResult.summary?.unavailable}件（比較可能 {batchResult.summary?.compared}件）</p><div style={{overflowX:"auto"}}><table><thead><tr><th>銘柄</th><th>判定</th><th>保存価格</th><th>参考終値</th><th>差額</th><th>取得結果</th></tr></thead><tbody>{batchResult.results?.map(x=><tr key={x.code}><td>{x.code}</td><td>{x.status} / {x.side}</td><td>{x.savedPrice}</td><td>{x.referenceClose??"未取得"}</td><td>{x.difference??"—"}</td><td>{x.result}</td></tr>)}</tbody></table></div><p>価格の一致は当時の予測可能性や学習性能を証明しません。本番AIへの反映不可。</p></>:<p>照合不可: {batchResult.reason??"UNKNOWN_ERROR"}</p>}</div>}
      <h2>価格照合の研究履歴</h2>
      <p>価格照合とは別操作です。保存時はJ-Quantsを再取得・再照合し、件数と判定結果だけを開発DBに記録します。株価・APIキー・本番AIは保存・変更しません。</p>
      <button type="button" disabled={saving} onClick={saveAudit} style={{padding:"12px 18px",border:"1px solid currentColor",borderRadius:8}}>{saving?"保存中…":"再照合して研究履歴に保存する"}</button>
      <button type="button" onClick={loadHistory} style={{padding:"12px 18px",marginLeft:8,border:"1px solid currentColor",borderRadius:8}}>保存履歴を表示</button>
      {saveResult&&<p role="status">{saveResult}</p>}
      {historyAnalysis&&<div role="status" style={{marginTop:16}}><h3>保存済み研究の分析（直近30回）</h3><p>実行履歴 {historyAnalysis.runsInWindow}回 ／ 異なる固定スナップショット {historyAnalysis.distinctSnapshots}件</p><p>{historyAnalysis.changedSincePreviousRun?"前回実行と判定件数に変化あり（要確認）":"前回実行との判定件数の変化なし"}</p><p>{historyAnalysis.independentEvidenceGrowth?"複数のスナップショットあり。独立性は別途検証が必要です。":"同じ固定6件の再照合は、独立した検証サンプルの増加ではありません。"}</p><p>本番AIへの反映：不可（価格基準・利用条件・検証数の承認待ち）</p></div>}
      <ul>{history.map(h=><li key={h.id}>{new Date(h.checked_at).toLocaleString("ja-JP",{timeZone:"Asia/Tokyo"})}｜一致 {h.matched_count}/{h.total_count}・差異 {h.differed_count}・判定不能 {h.blocked_count}（独立組 {h.unique_pairs}）</li>)}</ul>
    </section>
  );
}
