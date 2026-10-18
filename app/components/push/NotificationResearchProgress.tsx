"use client";

import { useCallback, useEffect, useState } from "react";
import SwingBenchmarkPanel from "./SwingBenchmarkPanel";

type ResearchType = "swing" | "surge" | "ai_rise" | "sharp_drop";
type ResearchItem = {
  key: ResearchType;
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
type ResearchReport = {
  checkedAt: string;
  note: string;
  categories: ResearchItem[];
};
const RESEARCH_OPTIONS: { key: ResearchType; label: string; icon: string }[] = [
  { key: "swing", label: "スイング候補", icon: "📈" },
  { key: "surge", label: "爆益前兆", icon: "🚀" },
  { key: "ai_rise", label: "AI評価急上昇", icon: "⚡" },
  { key: "sharp_drop", label: "急落警戒", icon: "⚠️" },
];
const fmt = (value: number | null) =>
  value == null ? "—" : `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;

export default function NotificationResearchProgress() {
  const [selected, setSelected] = useState<ResearchType>("swing");
  const [loading, setLoading] = useState(true);
  const [report, setReport] = useState<ResearchReport | null>(null);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/push/research-status", { cache: "no-store" });
      if (!response.ok) throw new Error(response.status === 404 ? "OWNER_ONLY" : "UNAVAILABLE");
      const json = await response.json() as ResearchReport & { success?: boolean };
      if (!json.success || !Array.isArray(json.categories)) throw new Error("UNAVAILABLE");
      setReport(json);
    } catch (failure) {
      setError(failure instanceof Error && failure.message === "OWNER_ONLY"
        ? "研究データは管理者専用です。"
        : "研究データを取得できませんでした。再度お試しください。");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const item = report?.categories.find((category) => category.key === selected);

  return (
    <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-black text-slate-900">📊 研究通知の検証成績</h3>
        <span className="shrink-0 rounded-full bg-amber-50 px-2 py-1 text-[10px] font-bold text-amber-800">
          4種類とも未配信
        </span>
      </div>
      <p className="mt-2 text-xs leading-5 text-slate-600">
        比較したい研究を1つ選んでね。ほかの研究は折り畳まれ、長いスクロールを減らせます。
      </p>

      <div className="mt-3 grid grid-cols-2 gap-2" role="tablist" aria-label="研究通知の種類">
        {RESEARCH_OPTIONS.map((option) => (
          <button key={option.key} type="button" role="tab"
            id={`research-tab-${option.key}`}
            aria-controls="research-selected-panel"
            aria-selected={selected === option.key}
            onClick={() => setSelected(option.key)}
            className={`min-h-[58px] rounded-xl border px-2 py-2 text-center text-xs font-black leading-5 transition-colors
              ${selected === option.key
                ? "border-blue-600 bg-blue-600 text-white shadow-sm"
                : "border-slate-200 bg-white text-slate-700"}`}>
            <span aria-hidden="true" className="mr-1">{option.icon}</span>{option.label}
          </button>
        ))}
      </div>

      <div id="research-selected-panel" role="tabpanel"
        aria-labelledby={`research-tab-${selected}`}
        className="mt-3 rounded-xl border border-slate-200 bg-white p-3">
        {loading && !report && <p role="status" className="text-xs text-slate-500">保存データを集計しています…</p>}
        {error && <p role="status" className="text-xs font-bold text-amber-800">{error}</p>}
        {item && (
          <div>
            <div className="flex items-center justify-between gap-2">
              <h4 className="text-base font-black text-slate-900">{item.title}</h4>
              <span className="text-[11px] font-bold text-slate-500">検証中</span>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3 text-xs text-slate-600">
              <div>研究記録
                <p className="mt-1 text-base font-black text-slate-900">{item.observed.toLocaleString("ja-JP")}件</p>
              </div>
              <div>5日後の結果
                <p className="mt-1 text-base font-black text-slate-900">{item.completed5.toLocaleString("ja-JP")}件</p>
              </div>
              <div>検証できた予測日
                <p className="mt-1 text-base font-black text-slate-900">{item.settledDays}日</p>
              </div>
              <div>平均5日後
                <p className="mt-1 text-base font-black text-slate-900">{fmt(item.meanReturn5)}</p>
              </div>
            </div>
            <p className="mt-3 text-xs font-bold leading-5 text-slate-700">
              {selected === "sharp_drop" ? "5日後も下落した割合" : "5日後に上昇した割合"}：
              {(selected === "sharp_drop" ? item.declineRate5 : item.riseRate5)?.toFixed(1) ?? "—"}%
            </p>
            <p className="mt-2 text-xs leading-5 text-slate-600">
              次に必要な検証：{item.reasons[0] ?? "独立期間での再検証"}
            </p>
            {selected === "swing" && <SwingBenchmarkPanel />}
          </div>
        )}
        {!item && !loading && !error && <p className="text-xs text-slate-600">この研究のデータはまだありません。</p>}
      </div>
      <div className="mt-3 flex items-center justify-between gap-2">
        <p className="text-[11px] leading-4 text-slate-500">研究結果は利益保証や売買推奨ではありません。</p>
        <button type="button" onClick={() => void refresh()} disabled={loading}
          className="shrink-0 rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-blue-700 disabled:opacity-50">
          {loading ? "更新中…" : "再集計"}
        </button>
      </div>
    </div>
  );
}
