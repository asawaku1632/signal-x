"use client";

import { useState, type ReactNode } from "react";

export const CRASH_DASHBOARD_TABS = [
  { id: "overview", label: "概要" },
  { id: "nextday", label: "暴落翌日" },
  { id: "market", label: "市場比較" },
  { id: "intraday", label: "当日強弱" },
  { id: "notes", label: "注意点" },
] as const;

export type CrashDashboardTab = (typeof CRASH_DASHBOARD_TABS)[number]["id"];

type Props = {
  overview: ReactNode;
  nextday: ReactNode;
  market: ReactNode;
  intraday: ReactNode;
  notes: ReactNode;
};

const shortcuts: { id: CrashDashboardTab; title: string; description: string; icon: string }[] = [
  { id: "nextday", title: "過去の翌日上昇率", description: "暴落後の翌日実績を確認", icon: "📊" },
  { id: "market", title: "日経平均との比較", description: "市場に強い・弱いを比較", icon: "⚖️" },
  { id: "intraday", title: "暴落当日と直近の強弱", description: "相対強弱とその後を確認", icon: "📈" },
  { id: "notes", title: "研究上の注意点", description: "母数・取引日・価格の限界", icon: "📋" },
];

export default function CrashStrengthDashboardTabs({ overview, nextday, market, intraday, notes }: Props) {
  const [active, setActive] = useState<CrashDashboardTab>("market");
  const panels: Record<CrashDashboardTab, ReactNode> = {
    overview, nextday, market, intraday, notes,
  };
  return (
    <div className="space-y-3">
      <nav aria-label="暴落後研究の表示切り替え"
        className="sticky top-0 z-30 -mx-3 border-y border-blue-100 bg-slate-50/95 px-3 py-2 shadow-sm backdrop-blur">
        <div role="tablist" aria-label="研究ダッシュボード"
          className="flex gap-1.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {CRASH_DASHBOARD_TABS.map(tab=> (
            <button type="button" role="tab" key={tab.id}
              id={"crash-tab-" + tab.id}
              aria-controls={"crash-panel-" + tab.id}
              aria-selected={active===tab.id}
              onClick={()=>setActive(tab.id)}
              className={"min-w-[82px] flex-1 shrink-0 rounded-xl border px-3 py-3 text-center text-xs font-black transition-colors sm:text-sm "+
                (active===tab.id
                  ? "border-blue-600 bg-blue-600 text-white shadow-sm"
                  : "border-slate-200 bg-white text-slate-700 hover:border-blue-300")}
            >{tab.label}</button>
          ))}
        </div>
      </nav>
      <section role="tabpanel" id={"crash-panel-" + active}
        aria-labelledby={"crash-tab-" + active} key={active}
        className="space-y-3 pb-4" tabIndex={0}>
        {panels[active]}
        {active==="overview" && <div className="grid grid-cols-2 gap-2">
          {shortcuts.map(item=> (
            <button type="button" key={item.id} onClick={()=>setActive(item.id)}
              className="rounded-xl border border-blue-100 bg-white p-3 text-left shadow-sm transition hover:border-blue-400">
              <span className="text-xl" aria-hidden="true">{item.icon}</span>
              <span className="mt-1 block text-sm font-black text-slate-900">{item.title} →</span>
              <span className="mt-1 block text-xs leading-5 text-slate-500">{item.description}</span>
            </button>
          ))}
        </div>}
      </section>
    </div>
  );
}
