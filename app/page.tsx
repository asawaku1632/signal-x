import Link from "next/link";

const menus = [
  {
    title: "SIGNALX DAILY",
    description: "今日の市場AI総括",
    href: "/daily",
    color: "from-purple-500 to-pink-500",
  },
  {
    title: "AI SCAN",
    description: "全銘柄AI監視",
    href: "/scan-mobile",
    color: "from-cyan-500 to-blue-500",
  },
  {
    title: "AI ALERT",
    description: "AI通知センター",
    href: "/alerts",
    color: "from-orange-500 to-red-500",
  },
  {
    title: "PATTERN AI",
    description: "本物ローソク分析",
    href: "/pattern-ranking",
    color: "from-green-500 to-emerald-500",
  },
  {
    title: "TIME AI",
    description: "強い時間帯と危険時間帯",
    href: "/time-ranking",
    color: "from-yellow-500 to-orange-500",
  },
  {
    title: "BACKTEST",
    description: "AI判定の勝率分析",
    href: "/backtest",
    color: "from-zinc-400 to-zinc-700",
  },
];

export default function HomePage() {
  return (
    <main className="min-h-screen bg-black text-white p-4 max-w-md mx-auto">
      <section className="rounded-3xl border border-purple-700 bg-gradient-to-br from-purple-950 to-black p-6 shadow-2xl">
        <p className="text-xs text-purple-300">
          AI MARKET SYSTEM
        </p>

        <h1 className="mt-3 text-5xl font-black">
          SIGNALX
        </h1>

        <p className="mt-4 text-sm text-zinc-300 leading-relaxed">
          AIが市場を監視し、
          <br />
          「今どうするべきか」を翻訳する。
        </p>
      </section>

      <section className="mt-6 space-y-4">
        {menus.map((menu) => (
          <Link
            key={menu.href}
            href={menu.href}
            className="block"
          >
            <div
              className={`rounded-3xl border border-zinc-800 bg-gradient-to-r ${menu.color} p-[1px] shadow-xl transition hover:scale-[1.02]`}
            >
              <div className="rounded-3xl bg-black p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-2xl font-black">
                      {menu.title}
                    </h2>

                    <p className="mt-2 text-sm text-zinc-400">
                      {menu.description}
                    </p>
                  </div>

                  <div className="text-3xl">
                    →
                  </div>
                </div>
              </div>
            </div>
          </Link>
        ))}
      </section>

      <section className="mt-6 rounded-3xl border border-zinc-800 bg-zinc-950 p-5">
        <p className="text-xs text-gray-500">
          SIGNALX CONCEPT
        </p>

        <div className="mt-4 space-y-3 text-sm text-zinc-300">
          <p>
            ・人生を壊さず投資と付き合う
          </p>

          <p>
            ・必要な時だけAIが呼ぶ
          </p>

          <p>
            ・「今日は休もう」を言えるAI
          </p>

          <p>
            ・初心者向けAI判断
          </p>
        </div>
      </section>
    </main>
  );
}