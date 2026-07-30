import PatternCard from "./PatternCard";
import type { DetectedChartPattern } from "@/app/lib/chartPatternEngine";

type PatternListProps = {
  detectedPatterns?: unknown;
  code: string;
};

function isDetectedChartPattern(value: unknown): value is DetectedChartPattern {
  if (!value || typeof value !== "object") return false;

  const pattern = value as Partial<DetectedChartPattern>;
  return (
    typeof pattern.id === "string" &&
    typeof pattern.name === "string" &&
    (pattern.direction === "BUY" || pattern.direction === "SELL" || pattern.direction === "NEUTRAL") &&
    typeof pattern.confidence === "number" &&
    Number.isFinite(pattern.confidence) &&
    typeof pattern.score === "number" &&
    Number.isFinite(pattern.score) &&
    Array.isArray(pattern.reasons) &&
    pattern.reasons.every((reason) => typeof reason === "string")
  );
}

export default function PatternList({ detectedPatterns, code }: PatternListProps) {
  const patterns = [...(Array.isArray(detectedPatterns) ? detectedPatterns : [])]
    .filter(isDetectedChartPattern)
    .sort((a, b) => {
      if (b.confidence !== a.confidence) return b.confidence - a.confidence;
      return Math.abs(b.score) - Math.abs(a.score);
    })
    .slice(0, 3);

  return (
    <section className="mt-3 min-w-0 rounded-[1.75rem] border border-white bg-white px-4 py-4 shadow-sm" aria-labelledby="detected-patterns-heading">
      <p className="text-[10px] font-black tracking-[0.18em] text-blue-600">CHART PATTERNS</p>
      <h2 id="detected-patterns-heading" className="mt-1 break-words text-xl font-black leading-snug">
        AIが検出したチャートパターン
      </h2>

      {patterns.length > 0 ? (
        <div className="mt-3 space-y-3">
          {patterns.map((pattern, index) => (
            <PatternCard key={`${pattern.id}-${index}`} pattern={pattern} rank={index + 1} code={code} />
          ))}
        </div>
      ) : (
        <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <p className="break-words text-sm font-black leading-6 text-slate-700">
            現在、明確なチャートパターンは検出されていません
          </p>
          <p className="mt-2 break-words text-xs font-bold leading-5 text-slate-500">
            方向が定まるまで、支持線・抵抗線と値動きを確認しましょう。
          </p>
        </div>
      )}
    </section>
  );
}
