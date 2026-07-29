import type { ChartPatternCatalogItem } from "@/app/lib/chartPatternCatalog";

const strokeColors = {
  BUY: "#059669",
  SELL: "#dc2626",
  NEUTRAL: "#2563eb",
} as const;

export default function PatternDiagram({
  pattern,
  compact = false,
}: {
  pattern: ChartPatternCatalogItem;
  compact?: boolean;
}) {
  return (
    <div className={`overflow-hidden rounded-2xl border border-slate-200 bg-white ${compact ? "p-2" : "p-4"}`}>
      <svg
        viewBox="0 0 100 58"
        className={compact ? "h-24 w-full" : "h-40 w-full"}
        role="img"
        aria-label={`${pattern.name}の簡易形状図`}
      >
        <defs>
          <linearGradient id={`grid-fade-${pattern.id}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#e2e8f0" stopOpacity="0.7" />
            <stop offset="100%" stopColor="#f8fafc" stopOpacity="0.3" />
          </linearGradient>
        </defs>
        {[12, 29, 46].map((y) => (
          <line key={y} x1="2" y1={y} x2="98" y2={y} stroke={`url(#grid-fade-${pattern.id})`} strokeWidth="0.8" />
        ))}
        <polyline
          points={pattern.diagramPoints}
          fill="none"
          stroke={strokeColors[pattern.direction]}
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="94" cy={pattern.diagramPoints.trim().split(" ").at(-1)?.split(",")[1] ?? "29"} r="3.5" fill={strokeColors[pattern.direction]} />
      </svg>
      <p className="mt-1 text-center text-[10px] font-bold leading-4 text-slate-400">
        形状を理解するための簡易図です。実際の値動きは一定ではありません。
      </p>
    </div>
  );
}
