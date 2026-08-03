"use client";

type ChartHeaderProps = {
  code: string; name: string; power: number; judge: string; judgeClass: string;
  trend: string; trendIcon: string; trendClass: string; currentPrice: number | null;
  ma20: number | null; ema20: number | null; vwap: number | null; macd: number | null;
};

function yen(value?: number | null) {
  if (value === undefined || value === null || Number.isNaN(value)) return "-";
  return `${Math.round(value).toLocaleString()}円`;
}

export default function ChartHeader(props: ChartHeaderProps) {
  const metrics = [
    { label: "MA20", value: yen(props.ma20), color: "text-emerald-600 dark:text-emerald-400" },
    { label: "EMA20", value: yen(props.ema20), color: "text-orange-500 dark:text-orange-400" },
    { label: "VWAP", value: yen(props.vwap), color: "text-blue-600 dark:text-blue-400" },
    { label: "MACD", value: props.macd === null || Number.isNaN(props.macd) ? "-" : props.macd.toFixed(2), color: "text-slate-500 dark:text-slate-400" },
  ];

  return (
    <section className="rounded-2xl border border-slate-200 bg-white px-3 py-2.5 shadow-sm dark:border-slate-700 dark:bg-slate-900 sm:px-3.5">
      <div className="flex min-w-0 items-center justify-between gap-3">
        <h1 className="min-w-0 truncate text-xl font-black tracking-tight sm:text-2xl">
          <span>{props.code}</span><span className="ml-2">{props.name}</span>
        </h1>
        <span className={`shrink-0 rounded-full border px-2.5 py-1 text-xs font-black ${props.trendClass}`}>
          <span aria-hidden>{props.trendIcon}</span> {props.trend.replace("トレンド", "")}
        </span>
      </div>

      <div className="mt-2 flex min-w-0 items-center gap-2.5 sm:gap-4">
        <div className="flex shrink-0 items-baseline gap-1.5">
          <span className="text-xs font-black text-slate-500 dark:text-slate-400">AI</span>
          <span className="text-xl font-black leading-none text-blue-600 dark:text-blue-400">{props.power}</span>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <span className="flex flex-col leading-tight text-slate-500 dark:text-slate-400">
            <span className="text-[10px] font-black">総合評価</span>
            <span className="text-[9px] font-bold">銘柄の有望度</span>
          </span>
          <span className={`rounded-full border px-2.5 py-1 text-xs font-black ${props.judgeClass}`}>{props.judge}</span>
        </div>
        <div className="ml-auto min-w-0 text-right">
          <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400">現在値 </span>
          <span className="whitespace-nowrap text-base font-black sm:text-lg">{yen(props.currentPrice)}</span>
        </div>
      </div>

      <dl className="mt-2 grid grid-cols-2 border-t border-slate-200 pt-1.5 text-xs min-[390px]:grid-cols-4 dark:border-slate-700 sm:text-sm">
        {metrics.map((metric, index) => (
          <div key={metric.label} className={`flex min-w-0 items-baseline gap-1 py-0.5 ${index % 2 ? "border-l border-slate-200 pl-2 dark:border-slate-700" : ""} min-[390px]:justify-center min-[390px]:border-l min-[390px]:px-2 min-[390px]:first:border-l-0 dark:min-[390px]:border-slate-700`}>
            <dt className={`shrink-0 font-black ${metric.color}`}>{metric.label}</dt>
            <dd className="truncate font-bold text-slate-800 dark:text-slate-100">{metric.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
