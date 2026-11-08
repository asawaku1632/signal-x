import Link from "next/link";
import BottomNav from "@/app/components/BottomNav";
import ChartPatternQuiz from "@/app/components/learning/ChartPatternQuiz";

export const metadata = {
  title: "チャート見方クイズ | SIGNALX",
  description: "ダブルボトム、9:05の情報、損失管理を3択で学ぶ教材。",
};

export default function ChartQuizPage() {
  return (
    <>
      <main className="min-h-screen bg-[#f7f9fc] pb-28 text-slate-900">
        <div className="mx-auto max-w-4xl px-4 pt-5 sm:px-6">
          <header className="mb-5 flex items-center gap-3">
            <Link href="/learning" className="inline-flex min-h-11 items-center rounded-xl border border-blue-200 bg-white px-4 text-sm font-black text-blue-700">
              ← 学習へ戻る
            </Link>
            <p className="text-sm font-black text-slate-600">SIGNALX / 学習</p>
          </header>
          <ChartPatternQuiz />
          <p className="mt-5 text-center text-xs leading-5 text-slate-500">
            架空の図を使った理解チェックです。実際の取引判断、推奨、勝率検証とは別です。
          </p>
        </div>
      </main>
      <BottomNav />
    </>
  );
}
