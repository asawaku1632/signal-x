"use client";

type AnalysisCardProps = {
  trend: string;
  pattern: string;
  aiScore: number;
  candleSignal: string;
};

function AnalysisTile({
  icon,
  value,
  tone,
}: {
  icon: string;
  value: string;
  tone: "blue" | "green" | "amber" | "slate";
}) {
  const style =
    tone === "blue"
      ? "border-blue-100 bg-blue-50 text-blue-800 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-200"
      : tone === "green"
        ? "border-emerald-100 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-200"
        : tone === "amber"
          ? "border-amber-100 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200"
          : "border-slate-200 bg-slate-50 text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100";

  return (
    <div className={`flex min-h-10 items-center gap-2 rounded-xl border px-3 py-2 ${style}`}>
      <span className="text-lg" aria-hidden>{icon}</span>
      <p className="min-w-0 text-sm font-black leading-5 md:text-base">{value}</p>
    </div>
  );
}

export default function AnalysisCard({
  trend,
  pattern,
  aiScore,
  candleSignal,
}: AnalysisCardProps) {
  return (
    <section className="rounded-[22px] border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <h2 className="text-xl font-black">チャート解析</h2>

      <div className="mt-2 grid grid-cols-2 gap-1.5">
        <AnalysisTile
          icon="📈"
          value={trend}
          tone={trend.includes("上昇") ? "green" : trend.includes("下降") ? "amber" : "slate"}
        />
        <AnalysisTile
          icon="📐"
          value={pattern}
          tone="blue"
        />
        <AnalysisTile
          icon="📊"
          value={`AI${aiScore}`}
          tone={aiScore >= 75 ? "green" : aiScore < 50 ? "amber" : "slate"}
        />
        <AnalysisTile
          icon="🕯"
          value={candleSignal}
          tone="slate"
        />
      </div>
    </section>
  );
}
