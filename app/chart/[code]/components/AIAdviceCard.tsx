import type { AdviceImportance } from "../aiAdvice";

type AIAdviceCardProps = {
  items: string[];
  importance: AdviceImportance;
};

const importanceStyles: Record<AdviceImportance, { icon: string; className: string }> = {
  強気: { icon: "🔥", className: "border-emerald-200 bg-emerald-100 text-emerald-800 dark:border-emerald-700 dark:bg-emerald-950 dark:text-emerald-200" },
  "強気・高値追い注意": { icon: "🔥", className: "border-orange-200 bg-orange-100 text-orange-900 dark:border-orange-700 dark:bg-orange-950 dark:text-orange-200" },
  "ブレイク期待・出来高確認待ち": { icon: "📈", className: "border-blue-200 bg-blue-100 text-blue-900 dark:border-blue-700 dark:bg-blue-950 dark:text-blue-200" },
  抵抗線接近: { icon: "⚠️", className: "border-amber-200 bg-amber-100 text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200" },
  "下降中・突破確認待ち": { icon: "⚠️", className: "border-amber-200 bg-amber-100 text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200" },
  下落警戒: { icon: "🚨", className: "border-red-200 bg-red-100 text-red-800 dark:border-red-700 dark:bg-red-950 dark:text-red-200" },
  様子見: { icon: "👀", className: "border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200" },
};

export default function AIAdviceCard({ items, importance }: AIAdviceCardProps) {
  const importanceStyle = importanceStyles[importance];

  return (
    <section className="rounded-[22px] border border-violet-200 bg-gradient-to-br from-violet-50 to-blue-50 p-3 shadow-sm dark:border-violet-800 dark:from-violet-950 dark:to-slate-900">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="shrink-0 text-xl font-black text-slate-900 dark:text-white">💡 AIアドバイス</h2>
        <span className={`max-w-full rounded-full border px-2.5 py-1 text-center text-[11px] font-black leading-4 sm:text-xs ${importanceStyle.className}`}>
          <span aria-hidden>{importanceStyle.icon}</span> {importance}
        </span>
      </div>
      <div className="mt-2 space-y-1.5">
        {items.slice(0, 2).map((item) => (
          <p key={item} className="text-sm font-bold leading-6 text-slate-700 dark:text-slate-200">
            ・{item}
          </p>
        ))}
      </div>
    </section>
  );
}
