import Link from "next/link";

const previewScreens = [
  {
    href: "/dashboard",
    title: "ホーム",
    description: "コンパクト化したダッシュボードを確認",
  },
  {
    href: "/today-market",
    title: "今日の市場",
    description: "市場評価・候補カードの密度を確認",
  },
  {
    href: "/analysis/6501",
    title: "AI分析（日立 6501）",
    description: "AI POWER・評価カードのコンパクト表示を確認",
  },
];

export default function UiPreviewPage() {
  return (
    <main className="min-h-screen bg-[#f7f9fc] px-4 py-6 text-slate-900">
      <div className="mx-auto max-w-md">
        <p className="text-xs font-black tracking-[0.18em] text-blue-600">
          SIGNALX UI PREVIEW
        </p>
        <h1 className="mt-2 text-2xl font-black">モバイルUI確認</h1>
        <p className="mt-2 text-sm font-bold leading-6 text-slate-500">
          作業ブランチ専用の確認入口です。下の画面を順番に開いて、
          本番と見比べてください。
        </p>

        <div className="mt-5 space-y-2">
          {previewScreens.map((screen) => (
            <Link
              key={screen.href}
              href={screen.href}
              className="block rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm transition active:scale-[0.99]"
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-base font-black">{screen.title}</div>
                  <div className="mt-0.5 text-xs font-bold text-slate-500">
                    {screen.description}
                  </div>
                </div>
                <span className="text-xl font-black text-blue-600">›</span>
              </div>
            </Link>
          ))}
        </div>

        <div className="mt-5 rounded-xl bg-blue-50 px-4 py-3 text-xs font-bold leading-5 text-blue-800">
          このページ自体は確認用です。main へはマージせず、UI確認後に削除します。
        </div>
      </div>
    </main>
  );
}
