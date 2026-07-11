"use client";

type AnalysisCardProps = {
  trend: string;
  pattern: string;
  score: number;
  candleSignal: string;
};

function AnalysisTile({
  icon,
  label,
  value,
  tone,
}: {
  icon: string;
  label: string;
  value: string;
  tone: "blue" | "green" | "amber" | "slate";
}) {
  const style =
    tone === "blue"
      ? "border-blue-100 bg-blue-50 text-blue-800"
      : tone === "green"
        ? "border-emerald-100 bg-emerald-50 text-emerald-800"
        : tone === "amber"
          ? "border-amber-100 bg-amber-50 text-amber-900"
          : "border-slate-200 bg-slate-50 text-slate-800";

  return (
    <div className={`rounded-[16px] border p-3 text-center ${style}`}>
      <div className="text-xl">{icon}</div>
      <p className="mt-1 text-[10px] font-black tracking-[0.12em] opacity-70">
        {label}
      </p>
      <p className="mt-1 text-base font-black md:text-lg">{value}</p>
    </div>
  );
}

export default function AnalysisCard({
  trend,
  pattern,
  score,
  candleSignal,
}: AnalysisCardProps) {
  return (
    <section className="rounded-[22px] border border-slate-200 bg-white p-3.5 shadow-sm">
      <p className="text-xs font-black tracking-[0.16em] text-blue-600">
        CHART ANALYSIS
      </p>
      <h2 className="mt-1 text-xl font-black">チャート解析</h2>

      <div className="mt-3 grid grid-cols-2 gap-2.5 md:grid-cols-4">
        <AnalysisTile
          icon="📈"
          label="トレンド"
          value={trend}
          tone={trend.includes("上昇") ? "green" : trend.includes("下降") ? "amber" : "slate"}
        />
        <AnalysisTile
          icon="📐"
          label="形状"
          value={pattern}
          tone="blue"
        />
        <AnalysisTile
          icon="📊"
          label="AIスコア"
          value={`${score}`}
          tone={score > 0 ? "green" : score < 0 ? "amber" : "slate"}
        />
        <AnalysisTile
          icon="🕯"
          label="足型"
          value={candleSignal}
          tone="slate"
        />
      </div>
    </section>
  );
}
