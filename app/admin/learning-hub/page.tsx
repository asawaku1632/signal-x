import Link from "next/link";
import { notFound } from "next/navigation";
import BottomNav from "@/app/components/BottomNav";
import { getLearningOwnerSession } from "@/app/lib/learningOwner";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type HubItem = { href: string; icon: string; title: string; detail: string; tag?: string };
const sections: { id: string; title: string; subtitle: string; items: HubItem[] }[] = [
  {
    id: "verification", title: "① 売買判断の答え合わせ",
    subtitle: "当たりも外れも、その後の株価で確かめる",
    items: [
      {
        href: "/simulation/conflict-check", icon: "🟣",
        title: "爆益前兆 × 撤退候補", tag: "新機能",
        detail: "矛盾する2つのシグナルを3・5・10取引日後に比較",
      },
      {
        href: "/simulation/exit-check", icon: "🔴",
        title: "撤退後の反発・続落",
        detail: "疑似保有の撤退候補が正しかったかを検証",
      },
      {
        href: "/simulation/universe-check", icon: "📊",
        title: "全銘柄スイング検証",
        detail: "疑似購入なしで1・3・5・10取引日の株価を比較",
      },
      {
        href: "/admin/ai-win-rate-audit", icon: "🎯",
        title: "AI勝率の信頼性監査",
        detail: "勝率の内訳と古いデータの限界を確認",
      },
    ],
  },
  {
    id: "research", title: "② 爆益前兆・研究モデル",
    subtitle: "どんな条件のときに上がりやすいか探す",
    items: [
      {
        href: "/admin/explosive-watch", icon: "🚀",
        title: "爆上げ候補ウォッチ",
        detail: "候補銘柄の前兆と未来追跡をまとめて確認",
      },
      {
        href: "/admin/research-lab", icon: "⛏️",
        title: "鉱脈研究所",
        detail: "4つの研究モデルの成績と重なりを比較",
      },
      {
        href: "/admin/momentum-memory", icon: "🧠",
        title: "爆益前兆（Momentum Memory）",
        detail: "前兆通知後の実績と検証ステータス",
      },
      {
        href: "/admin/golden-zone", icon: "⏰",
        title: "曜日・時間帯ゴールデンゾーン",
        detail: "曜日別・時間帯別の傾向とサンプル数",
      },
      {
        href: "/admin/pattern-performance", icon: "📚",
        title: "チャートパターン実績",
        detail: "パターン別の的中率と未来追跡",
      },
    ],
  },
  {
    id: "quality", title: "③ 学習・保存・品質",
    subtitle: "データが毎日きちんと蓄積されているか",
    items: [
      {
        href: "/admin/learning-status", icon: "💾",
        title: "日次学習・保存監視",
        detail: "保存件数、実行状況、エラーを確認",
      },
      {
        href: "/admin/evolution", icon: "🌱",
        title: "AI進化の履歴",
        detail: "学習による変化を時系列で確認",
      },
      {
        href: "/admin/daily-price-audit", icon: "🔎",
        title: "株価データの品質監査",
        detail: "表示価格と保存価格の差異などを調査",
      },
    ],
  },
];

export default async function PrivateLearningHubPage() {
  const { isOwner } = await getLearningOwnerSession();
  if (!isOwner) notFound();

  return (
    <main className="min-h-screen bg-slate-50 pb-28 text-slate-900">
      <div className="mx-auto max-w-2xl px-3 pt-4 sm:px-5">
        <div className="flex items-center justify-between gap-2">
          <Link href="/menu" className="text-xs font-black text-blue-600">← メニュー</Link>
          <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-bold text-slate-600">
            🔒 本人専用
          </span>
        </div>
        <header className="mt-4 rounded-2xl border border-indigo-100 bg-white px-4 py-5 shadow-sm">
          <p className="text-[10px] font-black tracking-widest text-indigo-600">SIGNALX PRIVATE RESEARCH</p>
          <h1 className="mt-1 text-2xl font-black">🧠 学習データ・管理室</h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            AIの予測、その後の結果、保存・学習状況をここからまとめて確認できます。
          </p>
          <p className="mt-2 text-[11px] leading-5 text-slate-500">
            これは管理・検証用の入口です。予測結果の有効性や利益を保証しません。
          </p>
        </header>

        <nav aria-label="学習データの分類" className="mt-3 grid grid-cols-3 gap-2">
          {[
            { href: "#verification", label: "📈 答え合わせ" },
            { href: "#research", label: "🚀 研究" },
            { href: "#quality", label: "💾 保存・品質" },
          ].map((item) => (
            <a key={item.href} href={item.href}
              className="rounded-xl border border-slate-200 bg-white px-1 py-3 text-center text-xs font-black text-slate-700">
              {item.label}
            </a>
          ))}
        </nav>

        {sections.map((section) => (
          <section id={section.id} key={section.id} className="mt-6 scroll-mt-4">
            <h2 className="text-base font-black">{section.title}</h2>
            <p className="mt-1 text-xs text-slate-500">{section.subtitle}</p>
            <div className="mt-3 space-y-2">
              {section.items.map((item) => (
                <Link key={item.href} href={item.href}
                  className="flex min-h-[76px] items-center gap-3 rounded-2xl border border-slate-200 bg-white px-3 py-3 shadow-sm active:bg-slate-50">
                  <span aria-hidden="true"
                    className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-indigo-50 text-xl">
                    {item.icon}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-black">{item.title}</span>
                      {item.tag ? <span className="rounded-md bg-violet-100 px-2 py-0.5 text-[10px] font-black text-violet-700">{item.tag}</span> : null}
                    </span>
                    <span className="mt-1 block text-xs leading-5 text-slate-500">{item.detail}</span>
                  </span>
                  <span aria-hidden="true" className="shrink-0 text-xl text-slate-400">›</span>
                </Link>
              ))}
            </div>
          </section>
        ))}
        <p className="mt-7 text-xs leading-5 text-slate-500">
          ※ この入口は本人だけに表示されます。リンク先のうち既存の管理者ページは各ページ固有のアクセス権限を引き続き適用します。
          今回の「爆益前兆 × 撤退候補」は画面・APIとも本人限定です。
        </p>
      </div>
      <BottomNav />
    </main>
  );
}
