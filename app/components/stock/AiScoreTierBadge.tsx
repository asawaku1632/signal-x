import { getAiScoreTier } from "@/app/lib/aiScoreTier";

const classes = {
  prime: "border-amber-300 bg-amber-100 text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200",
  main: "border-violet-200 bg-violet-100 text-violet-800 dark:border-violet-700 dark:bg-violet-950 dark:text-violet-200",
  buy: "border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-700 dark:bg-blue-950 dark:text-blue-200",
  pullback: "border-sky-200 bg-sky-50 text-sky-800 dark:border-sky-700 dark:bg-slate-800 dark:text-sky-200",
  watch: "border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200",
  skip: "border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-700 dark:bg-rose-950 dark:text-rose-200",
  unknown: "border-slate-200 bg-slate-50 text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400",
} as const;

export default function AiScoreTierBadge({
  score,
  size = "normal",
}: {
  score: number | null | undefined;
  size?: "normal" | "large";
}) {
  const tier = getAiScoreTier(score);
  return (
    <span
      data-testid="ai-score-tier-badge"
      title="AI POWERのスコア帯（売買推奨・実測勝率ではありません）"
      className={`inline-flex shrink-0 items-center rounded-md border font-black whitespace-nowrap ${size === "large" ? "px-2.5 py-1 text-sm leading-5" : "px-1.5 py-0.5 text-[10px] leading-4"} ${classes[tier.tone]}`}
    >
      {tier.label}
    </span>
  );
}
