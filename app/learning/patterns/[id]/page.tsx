import Link from "next/link";
import { notFound } from "next/navigation";
import BottomNav from "@/app/components/BottomNav";
import PatternDiagram from "@/app/components/patterns/PatternDiagram";
import { chartPatternCatalog, getChartPatternCatalogItem } from "@/app/lib/chartPatternCatalog";

const directionDetails = {
  BUY: { label: "買いパターン", badge: "bg-emerald-600 text-white" },
  SELL: { label: "売りパターン", badge: "bg-red-600 text-white" },
  NEUTRAL: { label: "中立・方向確認", badge: "bg-blue-600 text-white" },
} as const;

const difficultyLabels = { BEGINNER: "初級", INTERMEDIATE: "中級", ADVANCED: "上級" } as const;

export function generateStaticParams() {
  return chartPatternCatalog.map((pattern) => ({ id: pattern.id }));
}

function GuideSection({ title, items }: { title: string; items: string[] }) {
  return (
    <section className="rounded-[1.5rem] border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="text-lg font-black">{title}</h2>
      <ul className="mt-3 space-y-2">
        {items.map((item, index) => (
          <li key={`${title}-${index}`} className="flex min-w-0 items-start gap-2 text-sm font-bold leading-6 text-slate-600">
            <span className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-500" />
            <span className="min-w-0 break-words">{item}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default async function ChartPatternDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const pattern = getChartPatternCatalogItem(id);
  if (!pattern) notFound();
  const direction = directionDetails[pattern.direction];

  return (
    <main className="min-h-screen bg-[#f7f9fc] pb-24 text-slate-900">
      <div className="mx-auto max-w-3xl px-4 pt-4">
        <header className="flex items-center gap-3">
          <Link href="/learning/patterns" aria-label="チャートパターン図鑑へ戻る" className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-white text-2xl font-black shadow-sm">‹</Link>
          <div className="min-w-0">
            <p className="break-all text-[10px] font-black tracking-[0.16em] text-blue-600">{pattern.id}</p>
            <h1 className="break-words text-2xl font-black leading-tight min-[380px]:text-3xl">{pattern.name}</h1>
          </div>
        </header>

        <section className="mt-4 rounded-[1.75rem] border border-white bg-white p-4 shadow-sm">
          <PatternDiagram pattern={pattern} />
          <div className="mt-4 flex min-w-0 flex-wrap gap-2">
            <span className={`rounded-full px-3 py-1.5 text-xs font-black ${direction.badge}`}>{pattern.direction}・{direction.label}</span>
            <span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-black text-slate-700">{pattern.category}</span>
            <span className="rounded-full bg-amber-100 px-3 py-1.5 text-xs font-black text-amber-800">難易度 {difficultyLabels[pattern.difficulty]}</span>
          </div>
          <p className="mt-4 break-words text-base font-bold leading-7 text-slate-700">{pattern.summary}</p>
        </section>

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <GuideSection title="典型的な形成条件" items={pattern.formation} />
          <GuideSection title="AIが見るポイント" items={pattern.aiChecks} />
          <GuideSection title="エントリー時の考え方" items={pattern.entryGuide} />
          <GuideSection title="利確の考え方" items={pattern.takeProfitGuide} />
          <GuideSection title="損切の考え方" items={pattern.stopLossGuide} />
          <GuideSection title="注意点" items={pattern.cautions} />
        </div>

        <aside className="mt-4 rounded-[1.5rem] border border-amber-200 bg-amber-50 p-4 text-xs font-bold leading-6 text-amber-900">
          この図鑑はパターンの理解を助ける学習情報です。個別銘柄の売買を指示したり、将来の利益を保証したりするものではありません。
        </aside>
      </div>
      <BottomNav />
    </main>
  );
}
