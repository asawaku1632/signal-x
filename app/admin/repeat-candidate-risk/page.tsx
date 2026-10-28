"use client";

import { useEffect, useMemo, useState } from "react";

type Row = {
  trade_date: string; code: string; name: string;
  ai_power: number | string; entry_price: number | string;
  return_5d: number | string | null; outcome_5d_date: string | null;
  previous_candidate_date: string; previous_candidate_price: number | string;
  previous_candidate_change_pct: number | string | null;
};
type Response = { success: boolean; rows?: Row[]; truncated?: boolean; note?: string; error?: string };
const n = (v: number | string | null) => v == null ? null : Number(v);
const pct = (v: number | string | null) => {
  const value = n(v);
  return value == null || !Number.isFinite(value) ? "未検証" : `${value > 0 ? "+" : ""}${value.toFixed(2)}%`;
};
export default function RepeatCandidateRiskPage() {
  const [data, setData] = useState<Response | null>(null);
  const [error, setError] = useState("");
  const [onlyDrop, setOnlyDrop] = useState(true);
  useEffect(() => {
    let active = true;
    fetch("/api/admin/repeat-candidate-risk", { cache: "no-store" })
      .then(async r => {
        const result = await r.json() as Response;
        if (!r.ok || !result.success) throw new Error(result.error || "取得失敗");
        if (active) setData(result);
      }).catch(e => { if (active) setError(e instanceof Error ? e.message : "取得失敗"); });
    return () => { active = false; };
  }, []);
  const summary = useMemo(() => {
    const all = data?.rows || [];
    const groups = [
      { label: "前回比5%超下落", rows: all.filter(r => (n(r.previous_candidate_change_pct) ?? 0) < -5) },
      { label: "その他の再選出", rows: all.filter(r => (n(r.previous_candidate_change_pct) ?? 0) >= -5) },
    ];
    return groups.map(g => {
      const completed = g.rows.map(r => n(r.return_5d)).filter((v): v is number => v != null && Number.isFinite(v));
      const days = new Set(g.rows.filter(r => n(r.return_5d) != null).map(r => r.trade_date)).size;
      return { label: g.label, count: g.rows.length, checked: completed.length, days,
        average: completed.length ? completed.reduce((a, b) => a + b, 0) / completed.length : null };
    });
  }, [data]);
  const rows = useMemo(() => (data?.rows || []).filter(r =>
    !onlyDrop || (n(r.previous_candidate_change_pct) ?? 0) < -5), [data, onlyDrop]);
  return <main className="min-h-screen bg-slate-50 px-4 py-6 text-slate-900">
    <div className="mx-auto max-w-3xl space-y-4 rounded-2xl bg-white p-4">
      <a href="/admin/learning-hub" className="text-sm text-blue-700">← 学習管理へ</a>
      <h1 className="text-xl font-black">高POWER再選出・下落リスク｜研究専用</h1>
      <p className="text-sm text-slate-600">AI POWER90以上を対象に、前回CANDIDATE時の保存価格と、再選出時点の保存価格を比較します。AI POWERのみの簡易研究判定で、投資判断や通知には反映されません。</p>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={onlyDrop} onChange={e => setOnlyDrop(e.target.checked)} /> 前回候補比で5%超下落した銘柄のみ</label>
      {error && <p role="alert" className="text-rose-700">{error}</p>}
      {!data && !error && <p>研究データを取得中…</p>}
      {data && <><section aria-label="同日比較ではない参考集計" className="grid grid-cols-2 gap-2">
        {summary.map(g => <div key={g.label} className="rounded-xl border bg-slate-50 p-3">
          <p className="text-xs font-bold">{g.label}</p><p className="mt-1 text-lg font-black">{pct(g.average)}</p>
          <p className="text-xs text-slate-600">5日後平均・記録 {g.count}件 ／ 評価済 {g.checked}件 ／ 評価日数 {g.days}日</p>
        </div>)}
      </section><p className="text-xs text-amber-800">※ 上の2群は日付・業種・POWERを調整していない単純集計。将来の予測能力や除外効果は示しません。</p><p className="text-sm">表示 {rows.length}件 ／ 取得 {data.rows?.length ?? 0}件{data.truncated ? "（直近1000件のみ・全期間の集計ではありません）" : ""}</p>
        <div className="overflow-x-auto"><table className="w-full min-w-[650px] border-collapse text-left text-xs">
          <thead><tr className="border-b bg-slate-100"><th className="p-2">日付・銘柄</th><th className="p-2">前回候補</th><th className="p-2">前回比</th><th className="p-2">AI POWER</th><th className="p-2">5日後</th><th className="p-2">結果日</th></tr></thead>
          <tbody>{rows.map(r => <tr key={r.trade_date + ":" + r.code} className="border-b">
            <td className="p-2">{r.trade_date}<div className="font-bold">{r.code} {r.name}</div></td>
            <td className="p-2">{r.previous_candidate_date}</td>
            <td className="p-2 font-semibold">{pct(r.previous_candidate_change_pct)}</td>
            <td className="p-2">{n(r.ai_power)?.toFixed(1) ?? "不明"}</td>
            <td className="p-2">{pct(r.return_5d)}</td>
            <td className="p-2">{r.outcome_5d_date || "未確定"}</td>
          </tr>)}</tbody>
        </table></div>
        {rows.length === 0 && <p className="text-sm">該当記録はありません。</p>}
        <p className="text-xs text-amber-800">{data.note}</p>
        <p className="text-xs text-slate-500">価格の取得元・足の確定時刻・独立した終値照合は、この表示だけでは証明されません。将来の勝率や売買可能な価格を示すものではありません。</p>
      </>}
    </div>
  </main>;
}
