import Link from "next/link";
import { hasChartPatternCatalogItem } from "@/app/lib/chartPatternCatalog";

export type ScanDetectedPattern = {
  id: string;
  name: string;
  direction: "BUY" | "SELL" | "NEUTRAL";
  confidence: number;
  score: number;
  reasons: string[];
};

const directionStyles = {
  BUY: {
    container: "border-emerald-200 bg-emerald-50",
    badge: "bg-emerald-600 text-white",
    confidence: "text-emerald-700",
  },
  SELL: {
    container: "border-red-200 bg-red-50",
    badge: "bg-red-600 text-white",
    confidence: "text-red-700",
  },
  NEUTRAL: {
    container: "border-blue-200 bg-blue-50",
    badge: "bg-blue-600 text-white",
    confidence: "text-blue-700",
  },
} as const;

export function normalizeScanDetectedPatterns(value: unknown): ScanDetectedPattern[] {
  if (!Array.isArray(value)) return [];

  return value.filter((item): item is ScanDetectedPattern => {
    if (!item || typeof item !== "object") return false;
    const pattern = item as Partial<ScanDetectedPattern>;

    return (
      typeof pattern.id === "string" &&
      typeof pattern.name === "string" &&
      (pattern.direction === "BUY" ||
        pattern.direction === "SELL" ||
        pattern.direction === "NEUTRAL") &&
      typeof pattern.confidence === "number" &&
      Number.isFinite(pattern.confidence) &&
      typeof pattern.score === "number" &&
      Number.isFinite(pattern.score) &&
      Array.isArray(pattern.reasons) &&
      pattern.reasons.every((reason) => typeof reason === "string")
    );
  });
}

export default function DetectedPatternSummary({
  patterns,
  compact = false,
}: {
  patterns?: ScanDetectedPattern[];
  compact?: boolean;
}) {
  const pattern = [...normalizeScanDetectedPatterns(patterns)].sort((a, b) => {
    if (b.confidence !== a.confidence) return b.confidence - a.confidence;
    return Math.abs(b.score) - Math.abs(a.score);
  })[0];

  if (!pattern) return null;

  const styles = directionStyles[pattern.direction];
  const confidence = Math.round(Math.min(Math.max(pattern.confidence, 0), 100));
  const catalogHref = hasChartPatternCatalogItem(pattern.id)
    ? `/learning/patterns/${encodeURIComponent(pattern.id)}`
    : "/learning/patterns";

  return (
    <section
      className={`min-w-0 rounded-2xl border ${compact ? "p-2.5" : "p-3"} ${styles.container}`}
      aria-label={`AI検出パターン ${pattern.name}`}
    >
      <p className="text-[10px] font-black tracking-[0.12em] text-slate-500">
        AI検出パターン
      </p>
      <div className="mt-1.5 flex min-w-0 flex-wrap items-center gap-2">
        <p className="min-w-0 flex-1 break-words text-xs font-black leading-5 text-slate-900">
          {pattern.name}
        </p>
        <span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-black ${styles.badge}`}>
          {pattern.direction}
        </span>
      </div>
      <div className={`mt-2 flex min-w-0 gap-2 ${compact ? "flex-col" : "flex-col min-[360px]:flex-row min-[360px]:items-center min-[360px]:justify-between"}`}>
        <p className={`shrink-0 text-xs font-black ${styles.confidence}`}>
          信頼度 {confidence}%
        </p>
        <Link
          href={catalogHref}
          aria-label={`${pattern.name}をチャートパターン図鑑で見る`}
          className={`flex min-h-11 items-center justify-center rounded-xl border border-white/80 bg-white px-3 text-xs font-black text-blue-700 shadow-sm transition active:scale-[0.99] ${compact ? "w-full" : "w-full min-[360px]:w-auto"}`}
        >
          図鑑で見る&nbsp;→
        </Link>
      </div>
    </section>
  );
}
