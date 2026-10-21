"use client";

type ChartHeaderProps = {
  code: string; name: string; judge: string; judgeClass: string;
  trend: string; trendIcon: string; trendClass: string; currentPrice: number | null;
  historicalQuote: boolean;
};

function yen(value?: number | null) {
  if (value === undefined || value === null || Number.isNaN(value)) return "-";
  return `${Math.round(value).toLocaleString()}円`;
}

export default function ChartHeader(props: ChartHeaderProps) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white px-2.5 py-2 shadow-sm dark:border-slate-700 dark:bg-slate-900 sm:px-3">
      <div className="flex min-w-0 items-center gap-1.5">
        <span className="shrink-0 text-sm font-black text-blue-600 sm:text-base">{props.code}</span>
        <h1 className="min-w-0 flex-1 truncate text-sm font-black tracking-tight sm:text-base">{props.name}</h1>
        <span className="shrink-0 text-[10px] font-bold text-slate-500 dark:text-slate-400">
          {props.historicalQuote ? "前回参考値" : "参考値"}
        </span>
        <span className="shrink-0 text-sm font-black sm:text-base">{yen(props.currentPrice)}</span>
      </div>
      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
        <span className={`rounded-full border px-2 py-0.5 text-[11px] font-black ${props.judgeClass}`}>
          {props.historicalQuote ? "前回判定: " : "参考判定: "}{props.judge}
        </span>
        <span className={`rounded-full border px-2 py-0.5 text-[11px] font-black ${props.trendClass}`}>
          {props.historicalQuote ? "前回の傾向: " : "参考傾向: "}
          <span aria-hidden>{props.trendIcon}</span> {props.trend.replace("トレンド", "")}
        </span>
      </div>
    </section>
  );
}
