"use client";

import { useState } from "react";
import SwingBenchmarkPanel from "./SwingBenchmarkPanel";

type ResearchItem = {
  key: "swing" | "surge" | "ai_rise" | "sharp_drop";
  title: string;
  observed: number;
  completed5: number;
  settledDays: number;
  latestSignalDate: string | null;
  meanReturn5: number | null;
  riseRate5: number | null;
  declineRate5: number | null;
  benchmarked5: number;
  reviewStatus: "RESEARCH_ONLY";
  deliveryEnabled: false;
  reasons: string[];
};
type ResearchReport = { checkedAt: string; note: string; categories: ResearchItem[] };

function percent(value: number | null) {
  return value === null ? "データ不足" : `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}

export default function NotificationResearchProgress() {
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<ResearchReport | null>(null);
  const [error, setError] = useState("");

  async function refresh() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/push/research-status", { cache: "no-store" });
      if (!response.ok) {
        setError(response.status === 404 ? "研究データは管理者専用です。"
          : "研究データを取得できませんでした。再度お試しください。");
        return;
      }
      const result = await response.json() as ResearchReport & { success?: boolean };
      if (!result.success || !Array.isArray(result.categories)) throw new Error("Invalid evidence");
      setReport(result);
    } catch {
      setError("研究データを取得できませんでした。再度お試しください。");
    } finally {
      setLoading(false);
    }
  }

  function toggle() {
    if (!expanded && !report && !loading) void refresh();
    setExpanded(!expanded);
  }

  return (
    <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <button type="button" onClick={toggle} aria-expanded={expanded}
        className="flex w-full items-center justify-between gap-3 text-left">
        <span className="text-sm font-black text-slate-800">📊 研究通知4種類の検証進捗</span>
        <span className="text-xs font-bold text-blue-700">{expanded ? "閉じる ▲" : "見る ▼"}</span>
      </button>
      {expanded && (
        <div className="mt-3 space-y-3">
          <p className="text-xs font-bold leading-5 text-slate-600">
            予測時点の保存データと5つ先の日次保存値を比較。すべて研究中で、配信は停止しています。
          </p>
          {loading && <p role="status" className="text-xs text-slate-600">過去のデータを照合しています…</p>}
          {error && <p role="status" className="text-xs font-bold text-amber-800">{error}</p>}
          {report && report.categories.map((item) => (
            <div key={item.key} className="rounded-xl border border-slate-200 bg-white p-3">
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-black text-slate-900">{item.title}</p>
                <span className="shrink-0 text-[11px] font-bold text-slate-500">検証中・未配信</span>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-slate-700">
                <p>記録：<b>{item.observed.toLocaleString("ja-JP")}件</b></p>
                <p>5日後の結果：<b>{item.completed5.toLocaleString("ja-JP")}件</b></p>
                <p>検証できた予測日：<b>{item.settledDays}日</b></p>
                <p>平均5日後：<b>{percent(item.meanReturn5)}</b></p>
                <p className="col-span-2">
                  {item.key === "sharp_drop" ? "5日後も下落した割合" : "5日後に上昇した割合"}：
                  <b>{(item.key === "sharp_drop" ? item.declineRate5 : item.riseRate5)?.toFixed(1) ?? "—"}%</b>
                </p>
              </div>
              <p className="mt-2 text-xs leading-5 text-slate-600">
                次の検証：{item.reasons[0] ?? "独立期間での再検証"}
              </p>
              {item.key === "swing" && <SwingBenchmarkPanel />}
            </div>
          ))}
          {report && (
            <>
              <p className="text-xs leading-5 text-slate-500">{report.note}</p>
              <button type="button" disabled={loading} onClick={() => void refresh()}
                className="rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-blue-700 disabled:opacity-50">
                最新データに更新
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
