import Link from "next/link";

export default function PerformanceIndexPage() {
  return (
    <main className="min-h-screen bg-[#f7f9fc] px-4 py-8 text-slate-900">
      <div className="mx-auto max-w-md">
        <h1 className="text-3xl font-black">AI PERFORMANCE CENTER</h1>

        <p className="mt-3 text-sm font-bold text-slate-500">
          銘柄コードを指定してAI実績を確認してください。
        </p>

        <Link
          href="/performance/7203"
          className="mt-6 block rounded-2xl bg-blue-600 px-4 py-3 text-center font-black text-white"
        >
          トヨタ 7203 の実績を見る
        </Link>
      </div>
    </main>
  );
}