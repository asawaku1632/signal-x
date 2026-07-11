"use client";

type ChartHeaderProps = {
  code: string;
  name: string;
  power: number;
  judge: string;
  judgeClass: string;
  trend: string;
  trendIcon: string;
  trendClass: string;
  currentPrice: number | null;
  ma20: number | null;
  ema20: number | null;
  vwap: number | null;
  macd: number | null;
};

function yen(value?: number | null) {
  if (value === undefined || value === null || Number.isNaN(value)) return "-";
  return `${Math.round(value).toLocaleString()}円`;
}

function MetricCard({
  label,
  value,
  valueClass = "",
  badgeClass = "",
}: {
  label: string;
  value: string;
  valueClass?: string;
  badgeClass?: string;
}) {
  return (
    <div className="rounded-[16px] border border-slate-200 bg-slate-50 px-3 py-2.5 text-center">
      <p className="text-[10px] font-black tracking-[0.12em] text-slate-500">
        {label}
      </p>

      {badgeClass ? (
        <span
          className={`mt-2 inline-flex rounded-full border px-3 py-1.5 text-sm font-black ${badgeClass}`}
        >
          {value}
        </span>
      ) : (
        <p className={`mt-1 text-lg font-black ${valueClass}`}>{value}</p>
      )}
    </div>
  );
}

export default function ChartHeader({
  code,
  name,
  power,
  judge,
  judgeClass,
  trend,
  trendIcon,
  trendClass,
  currentPrice,
  ma20,
  ema20,
  vwap,
  macd,
}: ChartHeaderProps) {
  return (
    <section className="rounded-[22px] border border-slate-200 bg-white p-3.5 shadow-sm md:p-4">
      <div className="grid gap-3 md:grid-cols-[1fr_auto_1fr] md:items-center">
        <div>
          <p className="text-xs font-black tracking-[0.16em] text-blue-600">
            REAL STOCK CHART
          </p>
          <h1 className="mt-1 text-4xl font-black leading-none md:text-[44px]">
            {code}
          </h1>
          <p className="mt-1 text-lg font-black md:text-xl">{name}</p>
        </div>

        <div
          className={`flex items-center justify-center gap-3 rounded-[16px] border px-4 py-2.5 font-black ${trendClass}`}
        >
          <span className="text-2xl md:text-[28px]">{trendIcon}</span>
          <span className="text-lg md:text-xl">{trend}</span>
        </div>

        <div className="text-left md:text-right">
          <p className="text-[10px] font-black tracking-[0.14em] text-slate-500">
            AI POWER
          </p>
          <p className="mt-1 text-5xl font-black text-blue-600 md:text-[52px]">
            {power}
          </p>
          <span
            className={`mt-1.5 inline-flex rounded-full border px-3.5 py-1.5 text-sm font-black ${judgeClass}`}
          >
            {judge}
          </span>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2.5 md:grid-cols-6">
        <MetricCard
          label="現在値"
          value={yen(currentPrice)}
          valueClass="text-blue-600"
        />
        <MetricCard label="MA20" value={yen(ma20)} />
        <MetricCard label="EMA20" value={yen(ema20)} />
        <MetricCard label="VWAP" value={yen(vwap)} />
        <MetricCard
          label="MACD"
          value={macd === null || Number.isNaN(macd) ? "-" : macd.toFixed(2)}
        />
        <MetricCard label="判定" value={judge} badgeClass={judgeClass} />
      </div>
    </section>
  );
}
