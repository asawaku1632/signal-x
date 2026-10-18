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

const shortcuts: {
  id: CrashDashboardTab; title: string; subtitle: string; icon: string;
  colors: string; iconColors: string;
}[] = [
  { id: "nextday", title: "過去の翌日上昇率", subtitle: "過去データから傾向を確認",
    icon: "▥", colors: "border-blue-200 bg-blue-50/70", iconColors: "bg-gradient-to-br from-sky-400 to-blue-700" },
  { id: "intraday", title: "暴落日に相対的に強かった銘柄", subtitle: "当日の強さを分析",
    icon: "↗", colors: "border-rose-200 bg-rose-50/70", iconColors: "bg-gradient-to-br from-red-400 to-rose-700" },
  { id: "intraday", title: "直近・市場より強かった上位", subtitle: "最新データで確認",
    icon: "↗", colors: "border-emerald-200 bg-emerald-50/70", iconColors: "bg-gradient-to-br from-emerald-400 to-green-700" },
  { id: "notes", title: "研究上の注意点", subtitle: "必ずご確認ください",
    icon: "▤", colors: "border-violet-200 bg-violet-50/70", iconColors: "bg-gradient-to-br from-fuchsia-400 to-violet-700" },
];

export default function CrashStrengthDashboardTabs({ overview, nextday, market, intraday, notes }: Props) {
  const [active, setActive] = useState<CrashDashboardTab>("market");
  const panels: Record<CrashDashboardTab, ReactNode> = {
    overview, nextday, market, intraday, notes,
  };
  return (
    <div className="space-y-2">
      <nav aria-label="暴落後研究の表示切り替え"
        className="sticky top-0 z-30 -mx-2 border-b border-blue-100 bg-slate-50/95 px-2 py-1.5 shadow-sm backdrop-blur">
        <div role="tablist" aria-label="研究ダッシュボード"
          className="grid grid-cols-5 gap-1">
          {CRASH_DASHBOARD_TABS.map(tab=> (
            <button type="button" role="tab" key={tab.id}
              id={"crash-tab-" + tab.id}
              aria-controls={"crash-panel-" + tab.id}
              aria-selected={active===tab.id}
              onClick={()=>setActive(tab.id)}
              className={"min-w-0 whitespace-nowrap rounded-lg border px-0.5 py-2 text-center text-[11px] font-black transition-colors sm:text-sm "+
                (active===tab.id
                  ? "border-blue-600 bg-blue-600 text-white shadow-sm"
                  : "border-slate-200 bg-white text-slate-700 hover:border-blue-300")}
            >{tab.label}</button>
          ))}
        </div>
      </nav>
      <section role="tabpanel" id={"crash-panel-" + active}
        aria-labelledby={"crash-tab-" + active} key={active}
        className="space-y-2 pb-4" tabIndex={0}>
        {panels[active]}
        {(active==="market" || active==="overview") && <>
          <div aria-label="研究画面のショートカット" className="grid grid-cols-2 gap-2">
            {shortcuts.map((item,i)=> (
              <button type="button" key={item.title+"-"+i} onClick={()=>{
                setActive(item.id);
                document.getElementById("crash-tab-"+item.id)?.scrollIntoView({behavior:"smooth",block:"start"});
              }} className={"flex min-h-[84px] items-center gap-2 rounded-xl border p-2 text-left transition hover:brightness-95 "+item.colors}>
                <span aria-hidden="true" className={"flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-2xl font-black text-white "+item.iconColors}>{item.icon}</span>
                <span className="min-w-0 flex-1">
                  <span className="block text-xs font-black leading-4 text-slate-900">{item.title}</span>
                  <span className="mt-0.5 block text-[10px] leading-4 text-slate-500">{item.subtitle}</span>
                </span>
                <span aria-hidden="true" className="text-sm font-black text-slate-800">›</span>
              </button>
            ))}
          </div>
          <p className="rounded-xl border border-blue-100 bg-blue-50/60 p-3 text-[11px] leading-5 text-slate-600">
            <b className="text-slate-800">ⓘ このコンテンツについて</b>
            <span className="mt-1 block">本人専用の研究データです。特定銘柄の購入を推奨するものではありません。</span>
          </p>
        </>}
      </section>
    </div>
  );
}
