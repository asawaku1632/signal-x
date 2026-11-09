"use client";

import { useCallback, useEffect, useState } from "react";
import BottomNav from "@/app/components/BottomNav";

type Outcome = { days: number; date: string | null; price: number | null; changePercent: number | null };
type Item = {
  id: string; code: string; name: string; signalDate: string; scanAt: string;
  decisionStatus: "HOLD" | "EXIT"; cohort: "MANUAL" | "CRON";
  signalPrice: number; aiPower: number; reasons: string[]; outcomes: Outcome[];
};
type Summary = {
  days: number; evaluated: number; correct: number; correctRate: number | null;
  averagePercent: number | null; medianPercent: number | null;
};
type Group = {
  cohort: "MANUAL" | "CRON"; decisionStatus: "HOLD" | "EXIT";
  total: number; codes: number; horizons: Summary[];
};
type Report = { success: boolean; count: number; items: Item[]; groups: Group[]; note: string };
type Saved = { success: boolean; captured?: number; holds?: number; exits?: number; eligible?: number; skipped?: string | null; error?: string };

const pct = (n: number | null) => n == null ? "未確定" : (n > 0 ? "+" : "") + n.toFixed(2) + "%";
const yen = (n: number | null) => n == null ? "未確定" : n.toLocaleString("ja-JP") + "円";
const localTime = (s: string) => new Date(s).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" });

export default function SwingDecisionForwardPage() {
  const [report, setReport] = useState<Report | null>(null);
  const [cohort, setCohort] = useState<"MANUAL" | "CRON">("MANUAL");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    const response = await fetch("/api/swing-decision-forward", { cache: "no-store" });
    const body = await response.json() as Report & { error?: string };
    if (!response.ok) throw new Error(body.error ?? "検証データを読み込めませんでした");
    setReport(body);
  }, []);
  useEffect(() => {
    let active = true;
    void load().catch(cause => {
      if (active) setError(cause instanceof Error ? cause.message : "読込に失敗しました");
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [load]);

  async function saveCurrent() {
    if (saving) return;
    setSaving(true); setError(""); setMessage("");
    try {
      const response = await fetch("/api/swing-decision-forward", { method: "POST", cache: "no-store" });
      const data = await response.json() as Saved;
      if (!response.ok) throw new Error(data.error ?? "保存できませんでした");
      setMessage(data.skipped
        ? "今回は記録なし（" + data.skipped + "）。当日の新しい市場スキャンが必要です。"
        : "新規記録 " + (data.captured ?? 0) + "件：継続保有 " + (data.holds ?? 0) +
          "件／撤退候補 " + (data.exits ?? 0) + "件（判定対象 " + (data.eligible ?? 0) + "件）");
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "保存できませんでした");
    } finally { setSaving(false); }
  }

  const groups = report?.groups.filter(group => group.cohort === cohort) ?? [];
  const items = report?.items.filter(item => item.cohort === cohort) ?? [];
  return <main className="min-h-screen bg-slate-50 pb-24 text-slate-900">
    <div className="mx-auto min-h-screen max-w-md bg-white px-4 py-5 shadow-sm">
      <a href="/simulation" className="text-sm font-bold text-blue-600">← 疑似投資に戻る</a>
      <h1 className="mt-5 text-2xl font-black">🔬 継続保有 VS 撤退候補</h1>
      <p className="mt-2 text-sm leading-6 text-slate-600">
        その時点でSIGNALXが「継続保有」「撤退候補」と判定した銘柄を固定し、
        1・3・5・10取引日後に上昇／下落した割合を比較する研究です。
      </p>
      <div className="mt-5 rounded-2xl border border-blue-200 bg-blue-50 p-4">
        <p className="text-sm font-black text-blue-900">今の判定を研究記録</p>
        <p className="mt-1 text-xs leading-5 text-blue-800">
          最新のサーバー保存スキャンで全疑似保有銘柄を再判定します。
          手元の画面表示をそのまま転記せず、保存時刻も残します。実売買はありません。
        </p>
        <button type="button" disabled={saving} onClick={() => void saveCurrent()}
          className="mt-3 w-full rounded-xl bg-blue-600 py-3 text-sm font-black text-white disabled:opacity-50">
          {saving ? "保存中…" : "現在の判定を保存"}
        </button>
        {message && <p className="mt-3 text-xs font-bold leading-5 text-blue-800">{message}</p>}
      </div>
      {loading && <p className="py-6 text-center text-sm text-slate-500">読み込み中…</p>}
      {error && <p className="mt-4 rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
      {report && <>
        <div className="mt-5 grid grid-cols-2 gap-2 rounded-xl bg-slate-100 p-1">
          <button type="button" onClick={() => setCohort("MANUAL")}
            className={"rounded-lg py-3 text-sm font-bold " + (cohort === "MANUAL" ? "bg-white text-blue-600 shadow" : "text-slate-500")}>
            手動保存
          </button>
          <button type="button" onClick={() => setCohort("CRON")}
            className={"rounded-lg py-3 text-sm font-bold " + (cohort === "CRON" ? "bg-white text-blue-600 shadow" : "text-slate-500")}>
            定時保存
          </button>
        </div>
        <p className="mt-3 text-xs text-slate-500">
          直近最大250件。手動・定時では観測時刻が異なるので混ぜずに比較します。
        </p>
        {groups.map(group => <section key={group.decisionStatus}
          className={"mt-4 rounded-2xl border p-4 " +
          (group.decisionStatus === "HOLD" ? "border-blue-200 bg-blue-50" : "border-rose-200 bg-rose-50")}>
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-black">
              {group.decisionStatus === "HOLD" ? "🔵 継続保有" : "🔴 撤退候補"}
            </h2>
            <span className="text-sm font-black">{group.total}記録 / {group.codes}銘柄</span>
          </div>
          <p className="mt-1 text-xs text-slate-600">
            {group.decisionStatus === "HOLD" ? "判定後に上昇したら的中" : "判定後に下落したら的中"}
          </p>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-right text-xs tabular-nums">
              <thead><tr className="border-b border-slate-200 text-slate-500">
                <th className="py-2 text-left">経過</th><th>完了</th>
                <th>的中率</th><th>平均変化</th><th>中央値</th>
              </tr></thead>
              <tbody>{group.horizons.map(h => <tr key={h.days} className="border-b border-white/70">
                <th className="py-2 text-left">{h.days}取引日</th>
                <td>{h.evaluated}/{group.total}</td>
                <td>{h.correctRate == null ? "—" : h.correctRate.toFixed(1) + "%"}</td>
                <td>{pct(h.averagePercent)}</td>
                <td>{pct(h.medianPercent)}</td>
              </tr>)}</tbody>
            </table>
          </div>
        </section>)}
        <h2 className="mt-7 text-lg font-black">銘柄別の事前記録</h2>
        {items.length === 0 && <p className="mt-3 rounded-2xl border border-dashed p-4 text-sm text-slate-500">
          まだ記録なし。市場の最新スキャンが保存された後に「現在の判定を保存」で開始できます。
        </p>}
        <div className="mt-3 space-y-3">{items.map(item => <article key={item.id} className="rounded-2xl border p-4">
          <div className="flex items-start justify-between gap-2">
            <div><p className="text-xs text-slate-500">{item.code} / {item.signalDate}</p>
              <h3 className="font-black">{item.name}</h3></div>
            <span className={"shrink-0 rounded-full px-3 py-1 text-xs font-bold " +
              (item.decisionStatus === "HOLD" ? "bg-blue-50 text-blue-700" : "bg-rose-50 text-rose-700")}>
              {item.decisionStatus === "HOLD" ? "継続保有" : "撤退候補"}
            </span>
          </div>
          <p className="mt-2 text-xs text-slate-600">
            保存基準 {yen(item.signalPrice)} / AI {item.aiPower.toFixed(1)}
          </p>
          <p className="mt-1 text-[11px] text-slate-500">スキャン {localTime(item.scanAt)}</p>
          <div className="mt-3 grid grid-cols-4 gap-1.5">{item.outcomes.map(outcome =>
            <div key={outcome.days} className="rounded-lg bg-slate-50 p-2 text-center">
              <p className="text-[10px] text-slate-500">{outcome.days}日後</p>
              <p className={"mt-1 text-xs font-black " +
                (outcome.changePercent == null ? "text-slate-400" :
                  outcome.changePercent < 0 ? "text-rose-600" : "text-emerald-700")}>
                {pct(outcome.changePercent)}
              </p>
            </div>
          )}</div>
          {item.reasons.length > 0 && <p className="mt-3 text-xs leading-5 text-slate-500">
            判定理由：{item.reasons.join(" / ")}
          </p>}
        </article>)}</div>
        <p className="mt-6 text-xs leading-5 text-slate-500">{report.note}</p>
      </>}
    </div>
    <BottomNav />
  </main>;
}
