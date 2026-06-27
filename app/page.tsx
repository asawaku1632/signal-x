import Link from "next/link";
import Image from "next/image";

const todayStats = [
  ["1006", "監視銘柄"],
  ["952", "取得済み"],
  ["40", "激熱候補"],
  ["158", "本命候補"],
  ["V3", "AI POWER"],
];

const topStocks = [
  {
    rank: "🥇",
    code: "2501",
    name: "サッポロHD",
    score: 100,
    label: "🔥 激熱候補",
    comment: "EMA・VWAP・MACDが強く、上昇トレンド継続に注目。",
  },
  {
    rank: "🥈",
    code: "9413",
    name: "テレビ東京HD",
    score: 99,
    label: "🔥 激熱候補",
    comment: "出来高と上昇率が強く、AI POWER上位を維持。",
  },
  {
    rank: "🥉",
    code: "8802",
    name: "三菱地所",
    score: 98,
    label: "🔥 激熱候補",
    comment: "VWAP上で推移し、Wボトム突破にも注目。",
  },
];

const screens = [
  {
    title: "📱 AIランキング",
    text: "1006銘柄からAIが注目銘柄を抽出",
    image: "/images/ranking.png",
    alt: "AIランキング画面",
  },
  {
    title: "📊 AI分析",
    text: "EMA・VWAP・MACDをAIが解説",
    image: "/images/analysis.png",
    alt: "AI分析画面",
  },
  {
    title: "📈 リアルチャート",
    text: "チャートとテクニカル指標を確認",
    image: "/images/chart.png",
    alt: "リアルチャート画面",
  },
];

const problems = [
  "何を買えばいいか分からない",
  "チャートが難しい",
  "毎日1000銘柄も見られない",
  "売買判断に迷う",
];

const solutions = [
  ["🤖 1006銘柄をAI分析", "毎日多数の日本株をAIが自動でチェックします。"],
  ["📈 注目銘柄をランキング化", "スコアの高い銘柄を分かりやすく表示します。"],
  ["📊 複数指標を総合判定", "EMA・VWAP・MACD・RSIなどをAIが総合評価します。"],
  ["💬 初心者向けに解説", "難しい指標を、行動しやすい言葉で表示します。"],
];

const features = [
  ["🤖 AI POWER", "AIが銘柄の強さをスコア化"],
  ["📈 AIランキング", "注目銘柄をランキング表示"],
  ["📊 テクニカル分析", "EMA・VWAP・MACD・RSIに対応"],
  ["🔔 LINE通知", "重要な銘柄情報を通知"],
  ["📱 スマホ対応", "毎朝スマホで確認しやすい画面"],
  ["💬 AIコメント", "初心者向けに分かりやすく解説"],
];

export default function HomePage() {
  return (
    <main className="min-h-screen bg-white text-slate-950">
      {/* HERO */}
      <section className="relative overflow-hidden bg-black px-5 py-12 text-white">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,#14532d55,transparent_45%)]" />

        <div className="relative mx-auto max-w-6xl">
          <div className="text-center">
            <p className="mb-5 inline-block rounded-full border border-yellow-400/40 bg-yellow-400/10 px-4 py-2 text-sm font-bold text-yellow-300">
              SIGNALX β版 公開中
            </p>

            <h1 className="text-5xl font-black tracking-tight text-yellow-300 md:text-7xl">
              SIGNAL-X
            </h1>

            <p className="mt-5 text-4xl font-black leading-tight md:text-6xl">
              AIが1006銘柄を分析。
              <br />
              あなたは、選ぶだけ。
            </p>

            <p className="mx-auto mt-6 max-w-2xl text-base leading-8 text-slate-300 md:text-lg">
              EMA・VWAP・MACD・RSIなど複数の指標をAIが総合判定。
              初心者でも迷わず使える日本株AI分析サービスです。
            </p>

            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <Link
                href="/scan-mobile"
                className="rounded-full bg-yellow-400 px-9 py-4 text-sm font-black text-black shadow-lg shadow-yellow-500/20"
              >
                無料で試してみる
              </Link>

              <Link
                href="/scan-mobile"
                className="rounded-full border border-white/20 bg-white/10 px-9 py-4 text-sm font-black text-white"
              >
                AIランキングを見る
              </Link>
            </div>
          </div>

          {/* PHONE MOCKUP */}
          <div className="mx-auto mt-12 max-w-sm rounded-[2.5rem] border border-white/20 bg-slate-950 p-4 shadow-2xl shadow-green-500/20">
            <div className="rounded-[2rem] bg-white p-4 text-slate-950">
              <div className="mb-4 flex items-center justify-between">
                <p className="text-xs font-black text-blue-600">
                  今日のSIGNALX
                </p>
                <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-black text-green-700">
                  🟢 強気
                </span>
              </div>

              <h2 className="text-2xl font-black leading-tight">
                AI市場スキャン
              </h2>

              <div className="mt-5 grid grid-cols-2 gap-3">
                {todayStats.slice(0, 4).map(([num, label]) => (
                  <div
                    key={label}
                    className="rounded-2xl bg-slate-50 p-4 text-center"
                  >
                    <p className="text-3xl font-black">{num}</p>
                    <p className="mt-1 text-xs font-bold text-slate-500">
                      {label}
                    </p>
                  </div>
                ))}
              </div>

              <div className="mt-4 rounded-2xl bg-black p-4 text-white">
                <p className="text-xs font-bold text-yellow-300">
                  AI POWER V3
                </p>
                <p className="mt-2 text-sm text-slate-300">
                  EMA / VWAP / MACD / RSI 対応
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* TODAY */}
      <section className="px-5 py-10">
        <div className="mx-auto max-w-5xl rounded-3xl border bg-white p-6 shadow-sm">
          <div className="mb-6 flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-black text-blue-600">
                今日のSIGNALX
              </p>
              <h2 className="text-3xl font-black">AI市場スキャン状況</h2>
              <p className="mt-2 text-sm text-slate-600">
                今日は攻められる相場です。Sランク・Aランクを中心に監視しましょう。
              </p>
            </div>

            <span className="shrink-0 rounded-full bg-green-100 px-4 py-2 text-sm font-black text-green-700">
              🟢 強気
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
            {todayStats.map(([num, label]) => (
              <div
                key={label}
                className="rounded-2xl bg-slate-50 p-5 text-center"
              >
                <p className="text-4xl font-black">{num}</p>
                <p className="mt-1 text-xs font-bold text-slate-500">
                  {label}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* TOP STOCKS */}
      <section className="bg-slate-50 px-5 py-14">
        <div className="mx-auto max-w-5xl">
          <div className="text-center">
            <p className="text-sm font-black text-blue-600">AI PICKUP</p>
            <h2 className="mt-2 text-4xl font-black">今日のAI注目銘柄</h2>
            <p className="mt-4 text-sm leading-7 text-slate-600">
              AI POWER V3が注目する銘柄をランキング形式で表示します。
            </p>
          </div>

          <div className="mt-8 grid gap-5 md:grid-cols-3">
            {topStocks.map((stock) => (
              <div
                key={stock.code}
                className="rounded-3xl border bg-white p-6 shadow-sm"
              >
                <div className="flex items-center justify-between">
                  <span className="text-3xl">{stock.rank}</span>
                  <span className="rounded-full bg-red-50 px-3 py-1 text-xs font-black text-red-600">
                    {stock.label}
                  </span>
                </div>

                <p className="mt-5 text-sm font-black text-slate-500">
                  {stock.code}
                </p>
                <h3 className="mt-1 text-2xl font-black">{stock.name}</h3>

                <div className="mt-5 rounded-2xl bg-black p-4 text-white">
                  <p className="text-xs font-bold text-yellow-300">AI POWER</p>
                  <p className="mt-1 text-4xl font-black">{stock.score}</p>
                </div>

                <p className="mt-4 text-sm leading-7 text-slate-600">
                  {stock.comment}
                </p>

                <Link
                  href={`/analysis/${stock.code}`}
                  className="mt-5 inline-block rounded-full bg-blue-600 px-5 py-3 text-sm font-black text-white"
                >
                  詳しく見る
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* SCREEN */}
      <section className="px-5 py-14">
        <div className="mx-auto max-w-5xl text-center">
          <p className="text-sm font-black text-blue-600">SCREEN</p>
          <h2 className="mt-2 text-4xl font-black">実際の画面</h2>
          <p className="mt-4 text-sm leading-7 text-slate-600">
            AIランキング・AI分析・リアルチャートをスマホで確認できます。
          </p>

          <div className="mt-8 grid gap-5 md:grid-cols-3">
            {screens.map((screen) => (
              <div
                key={screen.title}
                className="rounded-3xl border bg-slate-50 p-5 text-left"
              >
                <Image
                  src={screen.image}
                  alt={screen.alt}
                  width={400}
                  height={800}
                  className="h-72 w-full rounded-2xl object-cover shadow-lg"
                />

                <h3 className="mt-4 text-xl font-black">{screen.title}</h3>
                <p className="mt-2 text-sm text-slate-600">{screen.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PROBLEM */}
      <section className="bg-slate-50 px-5 py-14">
        <div className="mx-auto max-w-5xl text-center">
          <p className="text-sm font-black text-blue-600">PROBLEM</p>
          <h2 className="mt-2 text-4xl font-black leading-tight">
            株式投資でこんな悩みありませんか？
          </h2>

          <div className="mt-8 grid gap-4 md:grid-cols-4">
            {problems.map((text) => (
              <div
                key={text}
                className="rounded-2xl bg-white p-6 text-left text-lg font-black shadow-sm"
              >
                ✅ {text}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* SOLUTION */}
      <section className="px-5 py-14">
        <div className="mx-auto max-w-5xl text-center">
          <p className="text-sm font-black text-blue-600">SOLUTION</p>
          <h2 className="mt-2 text-4xl font-black">
            SIGNALXがAIでサポートします
          </h2>

          <div className="mt-8 grid gap-5 md:grid-cols-2">
            {solutions.map(([title, text]) => (
              <div key={title} className="rounded-3xl border p-7 text-left">
                <h3 className="text-xl font-black">{title}</h3>
                <p className="mt-4 text-sm leading-7 text-slate-600">
                  {text}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section className="bg-slate-50 px-5 py-14">
        <div className="mx-auto max-w-5xl text-center">
          <p className="text-sm font-black text-blue-600">FEATURES</p>
          <h2 className="mt-2 text-4xl font-black">主な機能</h2>

          <div className="mt-8 grid gap-5 md:grid-cols-3">
            {features.map(([title, text]) => (
              <div
                key={title}
                className="rounded-2xl bg-white p-6 text-left shadow-sm"
              >
                <h3 className="text-lg font-black">{title}</h3>
                <p className="mt-2 text-sm text-slate-600">{text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* BETA */}
      <section className="px-5 py-14">
        <div className="mx-auto max-w-3xl rounded-3xl bg-black p-8 text-center text-white shadow-2xl">
          <p className="text-sm font-black text-yellow-300">BETA RELEASE</p>
          <h2 className="mt-2 text-4xl font-black">SIGNALXは現在β版です</h2>
          <p className="mt-5 text-sm leading-7 text-slate-300">
            現在、AIランキング・AI分析・通知機能を中心に毎日アップデート中。
            利用者の声を反映しながら、より実用的な株式分析サービスへ育てています。
          </p>

          <Link
            href="/scan-mobile"
            className="mt-8 inline-block rounded-full bg-yellow-400 px-9 py-4 text-sm font-black text-black"
          >
            SIGNALXを試す
          </Link>
        </div>
      </section>

      {/* PRICE */}
      <section className="bg-slate-50 px-5 py-14">
        <div className="mx-auto max-w-5xl text-center">
          <p className="text-sm font-black text-blue-600">PRICE</p>
          <h2 className="mt-2 text-4xl font-black">料金プラン</h2>

          <div className="mt-8 grid gap-5 md:grid-cols-2">
            <div className="rounded-3xl border bg-white p-7 text-left shadow-sm">
              <p className="text-sm font-black text-blue-600">β版</p>
              <h3 className="mt-2 text-4xl font-black">無料</h3>
              <p className="mt-4 text-sm text-slate-600">
                現在はβ版として無料で利用できます。
              </p>
            </div>

            <div className="rounded-3xl border border-yellow-300 bg-yellow-50 p-7 text-left shadow-sm">
              <p className="text-sm font-black text-yellow-700">正式版予定</p>
              <h3 className="mt-2 text-4xl font-black">月額980円〜</h3>
              <p className="mt-4 text-sm text-slate-600">
                AI通知・詳細分析・実測勝率などを順次追加予定です。
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="px-5 py-14">
        <div className="mx-auto max-w-4xl text-center">
          <h2 className="text-4xl font-black leading-tight">
            まずは無料で、
            <br />
            今日のAIランキングを確認。
          </h2>

          <Link
            href="/scan-mobile"
            className="mt-8 inline-block rounded-full bg-blue-600 px-10 py-4 text-sm font-black text-white shadow-lg shadow-blue-200"
          >
            無料ではじめる
          </Link>
        </div>
      </section>

      {/* DISCLAIMER */}
      <section className="px-5 pb-12">
        <div className="mx-auto max-w-4xl rounded-2xl border border-amber-200 bg-amber-50 p-5">
          <h2 className="text-lg font-black text-amber-800">
            ご利用前の注意
          </h2>
          <p className="mt-3 text-sm leading-7 text-amber-900">
            SIGNALXは、投資判断をサポートするための情報提供サービスです。
            表示されるAI判定・ランキング・スコアは、将来の株価上昇や利益を保証するものではありません。
            最終的な投資判断はご自身の責任で行ってください。
          </p>
        </div>
      </section>
    </main>
  );
}