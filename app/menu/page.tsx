import Link from "next/link";
import BottomNav from "@/app/components/BottomNav";
import MenuSection, { type MenuItem } from "@/app/components/menu/MenuSection";

const analysisItems: MenuItem[] = [
  { title: "AI分析", description: "銘柄をAIで分析", href: "/scan-mobile", icon: "✦", accent: "bg-violet-50 text-violet-600" },
  { title: "パターン図鑑", description: "チャート形状を学ぶ", href: "/learning/patterns", icon: "📖", accent: "bg-blue-50 text-blue-600" },
  { title: "学習コース", description: "投資スキルを学習", href: "/learning", icon: "🎓", accent: "bg-indigo-50 text-indigo-600" },
  { title: "成績・統計", description: "AIの実績を確認", href: "/result-stats", icon: "▥", accent: "bg-violet-50 text-violet-600" },
  { title: "得意・苦手分析", description: "判定傾向を分析", href: "/pattern-learning", icon: "◎", accent: "bg-cyan-50 text-cyan-600" },
  { title: "バックテスト", description: "過去データで検証", href: "/backtest", icon: "⌁", accent: "bg-fuchsia-50 text-fuchsia-600" },
];

const supportItems: MenuItem[] = [
  { title: "ランキング", description: "AI上位銘柄を確認", href: "/ranking", icon: "🏆", accent: "bg-amber-50 text-amber-600" },
  { title: "ウォッチリスト", description: "登録銘柄を管理", href: "/favorites", icon: "◉", accent: "bg-teal-50 text-teal-600" },
  { title: "通知履歴", description: "過去の通知を確認", href: "/history", icon: "🔔", accent: "bg-emerald-50 text-emerald-600" },
  { title: "注目銘柄", description: "今日の注目銘柄", href: "/top-signals", icon: "★", accent: "bg-yellow-50 text-yellow-500" },
];

const accountItems: MenuItem[] = [
  { title: "PRO会員", description: "会員情報を確認", href: "/mypage", icon: "◆", accent: "bg-violet-50 text-violet-600" },
  { title: "設定", description: "各種設定を変更", href: "/mypage", icon: "⚙", accent: "bg-slate-100 text-slate-600" },
  { title: "お問い合わせ", description: "サポートへ連絡", href: "/contact", icon: "✉", accent: "bg-blue-50 text-blue-600" },
  { title: "ヘルプ", description: "使い方を確認", href: "/trust", icon: "?", accent: "bg-sky-50 text-sky-600" },
  { title: "利用規約", description: "利用規約を確認", href: "/terms", icon: "▤", accent: "bg-slate-100 text-slate-600" },
  { title: "バージョン情報", description: "SIGNALX Ver1.0", href: "#version-info", icon: "i", accent: "bg-blue-50 text-blue-600" },
];

export default function MenuPage() {
  return (
    <main className="min-h-screen bg-white pb-28 text-slate-900">
      <div className="mx-auto max-w-4xl px-4 pb-6 pt-5 sm:px-6 sm:pt-8">
        <header className="flex items-center justify-between gap-4 border-b border-slate-200 pb-4">
          <div className="min-w-0">
            <p className="text-[10px] font-black tracking-[0.2em] text-blue-600">SIGNALX NAVIGATION</p>
            <h1 className="mt-1 text-2xl font-black tracking-tight sm:text-3xl">メニュー</h1>
          </div>
          <Link
            href="/dashboard"
            aria-label="メニューを閉じてホームへ戻る"
            className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-slate-200 bg-white text-xl font-bold shadow-sm transition hover:bg-slate-100 active:scale-95"
          >
            ×
          </Link>
        </header>

        <div className="mt-6 space-y-8 sm:mt-8 sm:space-y-10">
          <MenuSection title="AI分析・学習" tone="violet" items={analysisItems} />
          <MenuSection title="投資サポート" tone="emerald" items={supportItems} />
          <MenuSection title="アカウント・その他" tone="blue" items={accountItems} />
        </div>

        <aside
          id="version-info"
          className="mt-8 scroll-mt-6 rounded-2xl border border-blue-100 bg-blue-50/70 px-4 py-3 text-center"
        >
          <p className="text-xs font-black tracking-[0.14em] text-blue-700">SIGNALX Ver1.0</p>
          <p className="mt-1 text-[11px] font-bold text-slate-500">AIとデータで、投資判断をもっとわかりやすく。</p>
        </aside>
      </div>
      <BottomNav />
    </main>
  );
}
