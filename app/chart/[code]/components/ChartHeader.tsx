"use client";

type ChartHeaderProps = {
  code: string; name: string; judge: string; judgeClass: string;
  trend: string; trendIcon: string; trendClass: string; currentPrice: number | null;
};

function yen(value?: number | null) {
  if (value === undefined || value === null || Number.isNaN(value)) return "-";
  return `${Math.round(value).toLocaleString()}円`;
}

export default function ChartHeader(props: ChartHeaderProps) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white px-2.5 py-2 shadow-sm dark:border-slate-700 dark:bg-slate-900 sm:px-3">
      <div className="flex min-w-0 items-center gap-2 whitespace-nowrap">
        <span className="shrink-0 text-sm font-black text-blue-600 sm:text-base">{props.code}</span>
        <h1 className="min-w-0 flex-1 truncate text-sm font-black tracking-tight sm:text-base">{props.name}</h1>
        <span className={`shrink-0 rounded-full border px-2 py-1 text-[11px] font-black ${props.judgeClass}`}>{props.judge}</span>
        <span className={`shrink-0 rounded-full border px-2 py-1 text-[11px] font-black ${props.trendClass}`}>
          <span aria-hidden>{props.trendIcon}</span> {props.trend.replace("トレンド", "")}
        </span>
        <span className="ml-auto shrink-0 text-[10px] font-bold text-slate-500 dark:text-slate-400">現在値</span>
        <span className="shrink-0 text-sm font-black sm:text-base">{yen(props.currentPrice)}</span>
      </div>
    </section>
  );
}
