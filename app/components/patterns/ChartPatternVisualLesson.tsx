import Link from "next/link";
import type { ChartPatternCatalogItem } from "@/app/lib/chartPatternCatalog";

const directionStyles = {
  BUY: { line: "#059669", badge: "bg-emerald-100 text-emerald-800", title: "上昇方向の形" },
  SELL: { line: "#dc2626", badge: "bg-rose-100 text-rose-800", title: "下落方向の形" },
  NEUTRAL: { line: "#2563eb", badge: "bg-blue-100 text-blue-800", title: "方向を確認する形" },
} as const;

function getPoints(value: string) {
  return value
    .trim()
    .split(/\s+/)
    .map((point) => point.split(",").map(Number))
    .filter((point): point is [number, number] =>
      point.length === 2 && Number.isFinite(point[0]) && Number.isFinite(point[1]),
    );
}

function LessonStep({
  number,
  title,
  children,
  color,
}: {
  number: number;
  title: string;
  children: string;
  color: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-2">
        <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-sm font-black text-white ${color}`}>
          {number}
        </span>
        <h3 className="text-sm font-black text-slate-900">{title}</h3>
      </div>
      <p className="mt-2 text-sm font-bold leading-6 text-slate-600">{children}</p>
    </div>
  );
}

/** Beginner-facing schematic shared by every catalog pattern except the dedicated double-bottom lesson. */
export default function ChartPatternVisualLesson({ pattern }: { pattern: ChartPatternCatalogItem }) {
  const points = getPoints(pattern.diagramPoints);
  const drawingPoints = points.length > 0 ? points : [[4, 29], [95, 29]] as [number, number][];
  const polyline = drawingPoints.map(([x, y]) => `${40 + x * 5.2},${35 + y * 4.1}`).join(" ");
  const markers = [
    drawingPoints[0],
    drawingPoints[Math.floor((drawingPoints.length - 1) / 2)],
    drawingPoints[drawingPoints.length - 1],
  ];
  const direction = directionStyles[pattern.direction];
  const firstFeature = pattern.formation[0] ?? pattern.summary;
  const confirmation = pattern.formation.at(-1) ?? pattern.aiChecks[0] ?? "値動きの変化を確認する";
  const check = pattern.aiChecks[0] ?? confirmation;
  const caution = pattern.cautions[0] ?? "形が崩れていないか確認する";

  return (
    <section aria-labelledby={`${pattern.id}-visual-lesson-heading`} className="rounded-3xl border border-blue-200 bg-white p-4 shadow-sm sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id={`${pattern.id}-visual-lesson-heading`} className="text-lg font-black text-slate-900">
          📖 {pattern.name}の見方（目印付き）
        </h2>
        <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-black text-blue-800">学習用の模式図</span>
      </div>
      <p className="mt-2 text-sm leading-6 text-slate-700">
        {direction.title}として整理された形です。線の流れを左から追い、下の3つの目印で「形を探す」「成立条件を確かめる」「崩れる条件を見る」の順に確認します。
      </p>

      <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-[#f8fafc] p-2 sm:p-3">
        <svg viewBox="0 0 600 300" className="h-auto w-full" role="img" aria-label={`${pattern.name}の学習用模式図。値動きを左から右に追うための目印を3つ表示。実際の株価ではありません。`}>
          <rect x="0" y="0" width="600" height="300" rx="18" fill="#f8fafc" />
          {[65, 120, 175, 230].map((y) => <line key={y} x1="36" x2="566" y1={y} y2={y} stroke="#e2e8f0" strokeWidth="1.5" />)}
          <polyline points={polyline} fill="none" stroke={direction.line} strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
          {markers.map(([x, y], index) => {
            const cx = 40 + x * 5.2;
            const cy = 35 + y * 4.1;
            return (
              <g key={`${pattern.id}-step-${index}`}>
                <circle cx={cx} cy={cy} r="14" fill="white" stroke={direction.line} strokeWidth="4" />
                <text x={cx} y={cy + 5} textAnchor="middle" fontSize="15" fontWeight="bold" fill={direction.line}>{index + 1}</text>
              </g>
            );
          })}
          <text x="36" y="278" fontSize="14" fill="#64748b" fontWeight="bold">値動きの始まり</text>
          <text x="566" y="278" textAnchor="end" fontSize="14" fill="#64748b" fontWeight="bold">新しい値動きへ →</text>
          <text x="36" y="27" fontSize="14" fill="#64748b" fontWeight="bold">※ 架空の値動き（実際の銘柄ではありません）</text>
        </svg>
      </div>

      <div className="mt-3 flex flex-wrap gap-2 text-xs font-black">
        <span className={`rounded-full px-3 py-1.5 ${direction.badge}`}>{direction.title}</span>
        <span className="rounded-full bg-slate-100 px-3 py-1.5 text-slate-700">番号は読む順番の目印</span>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        <LessonStep number={1} title="形を探す" color="bg-blue-600">{firstFeature}</LessonStep>
        <LessonStep number={2} title="成立条件を確かめる" color="bg-emerald-600">{`${confirmation}　チェック：${check}`}</LessonStep>
        <LessonStep number={3} title="崩れる条件を見る" color="bg-amber-600">{caution}</LessonStep>
      </div>

      <p className="mt-3 text-xs leading-5 text-slate-500">
        図の線と番号は形の流れを学ぶための模式表現で、実際の価格・検出結果・売買サインではありません。形が見えても、売買の判断や利益を保証するものではありません。
      </p>
      <Link href="/learning/chart-quiz" className="mt-4 flex min-h-11 items-center justify-center rounded-xl bg-blue-600 px-4 text-sm font-black text-white">
        🧠 3択クイズで復習する →
      </Link>
    </section>
  );
}
