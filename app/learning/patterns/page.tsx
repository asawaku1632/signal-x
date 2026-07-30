import Link from "next/link";
import BottomNav from "@/app/components/BottomNav";
import PatternCatalogExplorer from "@/app/components/patterns/PatternCatalogExplorer";
import { CHART_PATTERN_CATEGORIES, chartPatternCatalog } from "@/app/lib/chartPatternCatalog";

const categoryOrder = new Map(CHART_PATTERN_CATEGORIES.map((category, index) => [category, index]));
const sortedPatterns = [...chartPatternCatalog].sort((a, b) => {
  const categoryDifference = (categoryOrder.get(a.category) ?? 999) - (categoryOrder.get(b.category) ?? 999);
  if (categoryDifference !== 0) return categoryDifference;
  return a.name.localeCompare(b.name, "ja");
});

export default function ChartPatternCatalogPage() {
  return (
    <main className="min-h-screen bg-[#f7f9fc] pb-24 text-slate-900">
      <div className="pattern-page mx-auto max-w-6xl px-4 pt-5 sm:px-6 sm:pt-7">
        <header className="flex items-center gap-3">
          <Link href="/learning" aria-label="AI学習へ戻る" className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-white text-2xl font-black shadow-sm">‹</Link>
          <div className="min-w-0">
            <p className="text-[10px] font-black tracking-[0.18em] text-blue-600">PATTERN CATALOG</p>
            <h1 className="break-words text-2xl font-black leading-tight min-[380px]:text-3xl">チャートパターン図鑑</h1>
          </div>
        </header>

        <section className="pattern-fade-in mt-5 rounded-[1.75rem] border border-blue-200 bg-gradient-to-br from-white to-blue-50 p-5 shadow-sm sm:p-6">
          <p className="text-base font-black leading-7 text-slate-800">AIが検出するチャートパターンを、形・意味・売買方向から学べます。</p>
          <p className="mt-3 rounded-2xl bg-white/80 p-3 text-xs font-bold leading-6 text-slate-600">実際の売買判断では、出来高・トレンド・支持線・抵抗線もあわせて確認してください。</p>
          <p className="mt-3 text-xs font-black text-blue-700">Chart Pattern Engine 実装済み {chartPatternCatalog.length}パターンID</p>
        </section>

        <PatternCatalogExplorer patterns={sortedPatterns} />
      </div>
      <BottomNav />
    </main>
  );
}
