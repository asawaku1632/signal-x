import Link from "next/link";
import { notFound } from "next/navigation";
import BottomNav from "@/app/components/BottomNav";
import PatternDiagram from "@/app/components/patterns/PatternDiagram";
import {
  chartPatternCatalog,
  getChartPatternCatalogItem,
  getRelatedChartPatterns,
} from "@/app/lib/chartPatternCatalog";

const directionDetails = {
  BUY: { label: "買いパターン", badge: "bg-emerald-600 text-white" },
  SELL: { label: "売りパターン", badge: "bg-red-600 text-white" },
  NEUTRAL: { label: "中立・方向確認", badge: "bg-blue-600 text-white" },
} as const;

const difficultyLabels = { BEGINNER: "初級", INTERMEDIATE: "中級", ADVANCED: "上級" } as const;
const difficultyBadges = {
  BEGINNER: "border-emerald-200 bg-emerald-50 text-emerald-700",
  INTERMEDIATE: "border-amber-200 bg-amber-50 text-amber-700",
  ADVANCED: "border-rose-200 bg-rose-50 text-rose-700",
} as const;

export const dynamicParams = false;

export function generateStaticParams() {
  return chartPatternCatalog.map((pattern) => ({ patternId: pattern.id }));
}

function GuideSection({ title, items, checks = false }: { title: string; items: string[]; checks?: boolean }) {
  return (
    <section className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <h2 className="text-lg font-black">{title}</h2>
      <ul className="mt-4 space-y-3">
        {items.map((item, index) => (
          <li key={`${title}-${index}`} className="flex min-w-0 items-start gap-2 text-sm font-bold leading-6 text-slate-600">
            {checks ? (
              <span className="mt-0.5 shrink-0 text-base font-black text-emerald-600" aria-hidden="true">✓</span>
            ) : (
              <span className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-500" />
            )}
            <span className="min-w-0 break-words">{item}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function clampRating(value: number) {
  return Math.max(1, Math.min(5, value));
}

function getAiRatings(pattern: NonNullable<ReturnType<typeof getChartPatternCatalogItem>>) {
  const difficulty = { BEGINNER: 1, INTERMEDIATE: 2, ADVANCED: 3 }[pattern.difficulty];
  const categoryIndex = Math.max(0, chartPatternCatalog.findIndex(({ category }) => category === pattern.category));
  const categoryOffset = categoryIndex % 3;
  const checkDepth = pattern.aiChecks.length >= 4 ? 1 : pattern.aiChecks.length <= 2 ? -1 : 0;
  const featureDepth = pattern.formation.length >= 4 ? 1 : pattern.formation.length <= 2 ? -1 : 0;
  const cautionLoad = pattern.cautions.length >= 3 ? 1 : pattern.cautions.length <= 1 ? -1 : 0;
  const directionClarity = pattern.direction === "NEUTRAL" ? -1 : 0;

  return [
    { label: "検出安定性", value: clampRating(4 - difficulty + checkDepth + (categoryOffset === 0 ? 1 : 0)) },
    { label: "誤検出しやすさ", value: clampRating(2 + difficulty + cautionLoad - checkDepth + (categoryOffset === 2 ? 1 : 0)) },
    { label: "初心者おすすめ度", value: clampRating(6 - difficulty * 2 + directionClarity - Math.max(0, cautionLoad)) },
    { label: "実戦での使いやすさ", value: clampRating(4 - difficulty + checkDepth + featureDepth + directionClarity) },
  ];
}

function StarRating({ value }: { value: number }) {
  return (
    <span className="whitespace-nowrap text-lg tracking-[0.08em]" aria-label={`5段階中${value}`}>
      <span className="text-amber-400">{"★".repeat(value)}</span>
      <span className="text-slate-200">{"★".repeat(5 - value)}</span>
    </span>
  );
}

export default async function ChartPatternDetailPage({
  params,
  searchParams,
}: PageProps<"/learning/patterns/[patternId]">) {
  const { patternId } = await params;
  const query = await searchParams;
  const pattern = getChartPatternCatalogItem(patternId);
  if (!pattern) notFound();
  const rawCode = Array.isArray(query.code) ? query.code[0] : query.code;
  const code = typeof rawCode === "string" && /^\d{4}$/.test(rawCode) ? rawCode : null;
  const analysisBackHref = code ? `/analysis/${code}` : "/learning/patterns";
  const direction = directionDetails[pattern.direction];
  const aiRatings = getAiRatings(pattern);
  const relatedPatterns = getRelatedChartPatterns(pattern);

  return (
    <main className="min-h-screen bg-[#f7f9fc] pb-24 text-slate-900">
      <div className="pattern-page mx-auto max-w-4xl px-4 pt-5 sm:px-6 sm:pt-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link href={analysisBackHref} className="inline-flex min-h-11 items-center rounded-2xl border border-blue-200 bg-white px-4 text-sm font-black text-blue-700 shadow-sm transition hover:bg-blue-50">
            ← AI分析へ戻る
          </Link>
        </div>

        <header className="mt-4 flex items-center gap-3">
          <Link href="/learning/patterns" aria-label="チャートパターン図鑑へ戻る" className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-white text-2xl font-black shadow-sm">‹</Link>
          <div className="min-w-0">
            <h1 className="break-words text-2xl font-black leading-tight min-[380px]:text-3xl">{pattern.name}</h1>
          </div>
        </header>

        <section className="mt-6 rounded-[1.75rem] border border-white bg-white p-3 shadow-sm sm:p-5">
          <PatternDiagram pattern={pattern} />
          <div className="mt-4 flex min-w-0 flex-wrap gap-2">
            <span className={`rounded-full px-3 py-1.5 text-xs font-black ${direction.badge}`}>{pattern.direction}・{direction.label}</span>
            <span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-black text-slate-700">{pattern.category}</span>
            <span className={`rounded-full border px-3 py-1.5 text-xs font-black ${difficultyBadges[pattern.difficulty]}`}>
              {difficultyLabels[pattern.difficulty]}
            </span>
          </div>
        </section>

        <section className="mt-5 rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <h2 className="text-lg font-black">説明</h2>
          <p className="mt-3 break-words text-base font-bold leading-8 text-slate-700">{pattern.summary}</p>
        </section>

        <div className="mt-5 grid gap-5 md:grid-cols-2">
          <GuideSection title="特徴" items={pattern.formation} />
          <GuideSection title="AIチェック項目" items={pattern.aiChecks} checks />
          <GuideSection title="エントリー例" items={pattern.entryGuide} />
          <GuideSection title="利確例" items={pattern.takeProfitGuide} />
          <GuideSection title="損切例" items={pattern.stopLossGuide} />
          <GuideSection title="注意点" items={pattern.cautions} />
        </div>

        <section className="pattern-fade-in mt-6 rounded-[1.5rem] border border-blue-100 bg-gradient-to-br from-white to-blue-50 p-5 shadow-sm sm:p-6">
          <div>
            <p className="text-xs font-black tracking-[0.14em] text-blue-600">PATTERN INSIGHT</p>
            <h2 className="mt-1 text-xl font-black">SIGNALX AI評価</h2>
          </div>
          <dl className="mt-5 grid gap-3 sm:grid-cols-2">
            {aiRatings.map((rating) => (
              <div key={rating.label} className="flex items-center justify-between gap-4 rounded-2xl border border-white bg-white/90 px-4 py-3 shadow-sm">
                <dt className="text-sm font-black text-slate-700">{rating.label}</dt>
                <dd><StarRating value={rating.value} /></dd>
              </div>
            ))}
          </dl>
          <p className="mt-4 text-xs font-bold leading-5 text-slate-500">
            難易度・検出条件・注意点など、図鑑データをもとにした学習上の目安です。
          </p>
        </section>

        <section className="pattern-fade-in mt-6 rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <h2 className="text-xl font-black">関連パターン</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            {relatedPatterns.map((related) => {
              const relatedDirection = directionDetails[related.direction];
              const href = code
                ? `/learning/patterns/${related.id}?code=${code}`
                : `/learning/patterns/${related.id}`;

              return (
                <Link
                  key={related.id}
                  href={href}
                  className="group flex min-h-36 flex-col rounded-2xl border border-slate-200 p-4 transition duration-200 hover:-translate-y-1 hover:border-blue-300 hover:shadow-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
                >
                  <div className="flex flex-wrap gap-2">
                    <span className={`rounded-full px-2.5 py-1 text-[10px] font-black ${relatedDirection.badge}`}>
                      {related.direction}
                    </span>
                    <span className={`rounded-full border px-2.5 py-1 text-[10px] font-black ${difficultyBadges[related.difficulty]}`}>
                      {difficultyLabels[related.difficulty]}
                    </span>
                  </div>
                  <h3 className="mt-3 text-base font-black leading-6">{related.name}</h3>
                  <p className="mt-2 text-xs font-bold leading-5 text-slate-500">{related.category}</p>
                  <span className="mt-auto self-end pt-3 text-xs font-black text-blue-600 transition-transform duration-200 group-hover:translate-x-1">
                    詳しく見る <span aria-hidden="true">→</span>
                  </span>
                </Link>
              );
            })}
          </div>
        </section>

        <aside className="mt-4 rounded-[1.5rem] border border-amber-200 bg-amber-50 p-4 text-xs font-bold leading-6 text-amber-900">
          この図鑑はパターンの理解を助ける学習情報です。個別銘柄の売買を指示したり、将来の利益を保証したりするものではありません。
        </aside>
        <Link href={analysisBackHref} className="mt-5 flex min-h-12 items-center justify-center rounded-2xl bg-blue-600 px-4 text-sm font-black text-white shadow-sm transition hover:bg-blue-700">
          ← AI分析へ戻る
        </Link>
        <p className="mt-6 text-center text-[10px] font-bold tracking-[0.14em] text-slate-400">
          Pattern ID: {pattern.id}
        </p>
      </div>
      <BottomNav />
    </main>
  );
}
