import Link from "next/link";
import Image from "next/image";

const todayStats = [
  ["1006", "監視銘柄", "AIが毎日チェックする日本株"],
  ["952", "取得済み", "本日のデータ取得済み"],
  ["40", "激熱候補", "AI POWER 85以上"],
  ["158", "本命候補", "AI POWER 70以上"],
  ["V3", "AI POWER", "現在のAI判定エンジン"],
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
  ["🤖", "AI POWER", "AIが銘柄の強さをスコア化"],
  ["📈", "AIランキング", "注目銘柄をランキング表示"],
  ["📊", "テクニカル分析", "EMA・VWAP・MACD・RSIに対応"],
  ["🔔", "LINE通知", "重要な銘柄情報を通知"],
  ["📱", "スマホ対応", "毎朝スマホで確認しやすい画面"],
  ["💬", "AIコメント", "初心者向けに分かりやすく解説"],
];

const navLinks = [
  ["AIランキング", "/scan-mobile"],
  ["AI分析", "/analysis"],
  ["🛡 AI品質", "/trust"],
  ["AI進化", "/admin/evolution"],
];

export default function HomePage() {
  return (
    <main className="min-h-screen bg-[#f7f9fc] text-slate-950">
      {/* HERO */}
      <section className="relative overflow-hidden px-5 pb-14 pt-5 text-slate-950">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,#dbeafe,transparent_36%),radial-gradient(circle_at_top_right,#dcfce7,transparent_32%),linear-gradient(180deg,#ffffff_0%,#f7f9fc_72%)]" />

        <div className="relative mx-auto max-w-6xl">
          <header className="mb-8 flex items-center justify-between rounded-full border border-white/80 bg-white/80 px-4 py-3 shadow-sm backdrop-blur-xl">
            <Link href="/" className="flex items-center gap-2">
              <span className="grid h-10 w-10 place-items-center rounded-2xl bg-blue-600 text-lg font-black text-white shadow-lg shadow-blue-200">
                X
              </span>
              <span className="text-xl font-black tracking-tight">
                SIGNAL<span className="text-blue-600">X</span>
              </span>
            </Link>

            <nav className="hidden items-center gap-2 md:flex">
              {navLinks.map(([label, href]) => (
                <Link
                  key={label}
                  href={href}
                  className="rounded-full px-4 py-2 text-sm font-black text-slate-600 transition hover:bg-slate-100 hover:text-blue-600"
                >
                  {label}
                </Link>
              ))}
            </nav>

            <Link
              href="/login"
              className="rounded-full bg-slate-950 px-5 py-3 text-sm font-black text-white shadow-lg shadow-slate-300 transition hover:bg-blue-600"
            >
              Googleログイン
            </Link>
          </header>
                    <div className="grid items-center gap-10 lg:grid-cols-[1.06fr_0.94fr]">
            <div className="text-center lg:text-left">
              <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-blue-100 bg-white/80 px-4 py-2 text-sm font-black text-blue-600 shadow-sm">
                <span className="h-2 w-2 rounded-full bg-green-500" />
                SIGNALX β版 公開中
              </p>

              <h1 className="text-5xl font-black tracking-tight text-slate-950 md:text-7xl">
                AIが日本株を分析。
                <span className="mt-2 block bg-gradient-to-r from-blue-600 to-emerald-500 bg-clip-text text-transparent">
                  あなたは選ぶだけ。
                </span>
              </h1>

              <p className="mx-auto mt-6 max-w-2xl text-base font-medium leading-8 text-slate-600 md:text-lg lg:mx-0">
                EMA・VWAP・MACD・RSIなど複数の指標をAIが総合判定。
                難しいチャート判断を、初心者でも行動しやすい言葉に翻訳します。
              </p>

              <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row sm:flex-wrap lg:justify-start">
                <Link
                  href="/scan-mobile"
                  className="rounded-full bg-blue-600 px-9 py-4 text-sm font-black text-white shadow-xl shadow-blue-200 transition hover:-translate-y-0.5 hover:bg-blue-700"
                >
                  無料で試してみる
                </Link>

                <Link
                  href="/analysis"
                  className="rounded-full border border-slate-200 bg-white px-9 py-4 text-sm font-black text-slate-900 shadow-sm transition hover:-translate-y-0.5 hover:border-blue-200 hover:text-blue-600"
                >
                  AI分析を見る
                </Link>

                <Link
                  href="/trust"
                  className="rounded-full border border-blue-200 bg-blue-50 px-9 py-4 text-sm font-black text-blue-700 shadow-sm transition hover:-translate-y-0.5 hover:bg-blue-100"
                >
                  🛡 AI品質を見る
                </Link>
              </div>

              <div className="mt-8 grid grid-cols-3 gap-3 rounded-[2rem] border border-white bg-white/70 p-3 shadow-sm backdrop-blur-xl">
                {todayStats.slice(0, 3).map(([num, label]) => (
                  <div key={label} className="rounded-3xl bg-slate-50 p-4">
                    <p className="text-2xl font-black text-slate-950">{num}</p>
                    <p className="mt-1 text-xs font-black text-slate-500">
                      {label}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* PHONE MOCKUP */}
            <div className="mx-auto w-full max-w-sm">
              <div className="rounded-[3rem] border border-slate-200 bg-slate-950 p-3 shadow-2xl shadow-blue-200">
                <div className="rounded-[2.45rem] bg-white p-4">
                  <div className="mx-auto mb-4 h-1.5 w-20 rounded-full bg-slate-200" />

                  <div className="rounded-[2rem] bg-gradient-to-br from-slate-950 to-blue-950 p-5 text-white">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-black text-blue-200">
                        今日のSIGNALX
                      </p>
                      <span className="rounded-full bg-emerald-400/15 px-3 py-1 text-xs font-black text-emerald-300">
                        🟢 強気
                      </span>
                    </div>

                    <h2 className="mt-5 text-3xl font-black leading-tight">
                      AI市場
                      <br />
                      スキャン
                    </h2>

                    <p className="mt-3 text-sm leading-6 text-slate-300">
                      今日は攻められる相場。Sランク・Aランクを中心に監視。
                    </p>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-3">
                    {todayStats.slice(0, 4).map(([num, label]) => (
                      <div
                        key={label}
                        className="rounded-3xl bg-slate-50 p-4 text-center"
                      >
                        <p className="text-3xl font-black">{num}</p>
                        <p className="mt-1 text-xs font-bold text-slate-500">
                          {label}
                        </p>
                      </div>
                    ))}
                  </div>

                  <div className="mt-4 rounded-3xl border border-blue-100 bg-blue-50 p-4">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-black text-blue-700">
                        AI POWER V3
                      </p>
                      <span className="text-xs font-black text-blue-700">
                        ACTIVE
                      </span>
                    </div>
                    <p className="mt-2 text-sm font-bold leading-6 text-slate-700">
                      EMA / VWAP / MACD / RSI を総合判定
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
            {/* TODAY */}
      <section className="px-5 py-10">
        <div className="mx-auto max-w-6xl">
          <div className="rounded-[2.5rem] border border-white bg-white p-6 shadow-sm md:p-8">
            <div className="mb-6 flex flex-col justify-between gap-4 md:flex-row md:items-end">
              <div>
                <p className="text-sm font-black text-blue-600">
                  TODAY'S MARKET
                </p>
                <h2 className="mt-2 text-3xl font-black tracking-tight md:text-4xl">
                  今日のAI市場スキャン状況
                </h2>
                <p className="mt-3 max-w-2xl text-sm font-medium leading-7 text-slate-600">
                  今日は攻められる相場です。AI POWER上位の銘柄を中心に、
                  無理なく監視していきましょう。
                </p>
              </div>

              <span className="w-fit rounded-full bg-emerald-50 px-4 py-2 text-sm font-black text-emerald-700">
                🟢 強気
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
              {todayStats.map(([num, label, caption]) => (
                <div
                  key={label}
                  className="rounded-[1.75rem] border border-slate-100 bg-slate-50 p-5"
                >
                  <p className="text-4xl font-black tracking-tight text-slate-950">
                    {num}
                  </p>
                  <p className="mt-2 text-sm font-black text-slate-700">
                    {label}
                  </p>
                  <p className="mt-1 text-xs font-bold leading-5 text-slate-500">
                    {caption}
                  </p>
                </div>
              ))}
            </div>

            <Link
              href="/trust"
              className="mt-5 flex flex-col gap-4 rounded-[2rem] border border-blue-100 bg-gradient-to-r from-blue-50 via-white to-emerald-50 p-5 transition hover:-translate-y-0.5 hover:shadow-md sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex items-center gap-4">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-blue-600 text-2xl text-white shadow-lg shadow-blue-200">
                  🛡️
                </div>
                <div>
                  <p className="text-xs font-black tracking-[0.16em] text-blue-600">
                    AI TRUST CENTER
                  </p>
                  <h3 className="mt-1 text-xl font-black text-slate-950">
                    AI品質 100点・毎営業日学習中
                  </h3>
                  <p className="mt-1 text-sm font-bold leading-6 text-slate-500">
                    学習件数・的中率・改善状況を一般ユーザー向けに公開しています。
                  </p>
                </div>
              </div>

              <span className="shrink-0 text-sm font-black text-blue-600">
                詳しく見る →
              </span>
            </Link>
          </div>
        </div>
      </section>

      {/* TOP STOCKS */}
      <section className="px-5 py-14">
        <div className="mx-auto max-w-6xl">
          <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
            <div>
              <p className="text-sm font-black text-blue-600">AI PICKUP</p>
              <h2 className="mt-2 text-4xl font-black tracking-tight">
                今日のAI注目銘柄
              </h2>
              <p className="mt-4 max-w-2xl text-sm font-medium leading-7 text-slate-600">
                AI POWER V3が注目する銘柄をランキング形式で表示します。
                まずは上位銘柄から確認するだけでOKです。
              </p>
            </div>

            <Link
              href="/scan-mobile"
              className="w-fit rounded-full bg-slate-950 px-6 py-3 text-sm font-black text-white shadow-lg shadow-slate-200 transition hover:bg-blue-600"
            >
              ランキング一覧へ
            </Link>
          </div>

          <div className="mt-8 grid gap-5 md:grid-cols-3">
            {topStocks.map((stock) => (
              <div
                key={stock.code}
                className="rounded-[2rem] border border-white bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-xl"
              >
                <div className="flex items-center justify-between">
                  <span className="text-4xl">{stock.rank}</span>
                  <span className="rounded-full bg-red-50 px-3 py-1 text-xs font-black text-red-600">
                    {stock.label}
                  </span>
                </div>

                <p className="mt-6 text-sm font-black text-slate-500">
                  {stock.code}
                </p>
                <h3 className="mt-1 text-2xl font-black">{stock.name}</h3>

                <div className="mt-5 rounded-[1.5rem] bg-slate-950 p-5 text-white">
                  <p className="text-xs font-black text-blue-300">AI POWER</p>
                  <div className="mt-2 flex items-end justify-between">
                    <p className="text-5xl font-black">{stock.score}</p>
                    <p className="pb-1 text-xs font-bold text-slate-400">
                      / 100
                    </p>
                  </div>
                </div>

                <p className="mt-4 text-sm font-medium leading-7 text-slate-600">
                  {stock.comment}
                </p>

                <Link
                  href={`/analysis/${stock.code}`}
                  className="mt-5 inline-flex rounded-full bg-blue-600 px-5 py-3 text-sm font-black text-white shadow-lg shadow-blue-100 transition hover:bg-blue-700"
                >
                  詳しく見る
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>
            {/* SCREEN */}
      <section className="bg-white px-5 py-16">
        <div className="mx-auto max-w-6xl">
          <div className="text-center">
            <p className="text-sm font-black text-blue-600">APP PREVIEW</p>

            <h2 className="mt-2 text-4xl font-black tracking-tight">
              実際の画面イメージ
            </h2>

            <p className="mx-auto mt-4 max-w-2xl text-sm font-medium leading-7 text-slate-600">
              Apple・Google Material 3を意識した、
              シンプルで見やすい画面デザイン。
            </p>
          </div>

          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {screens.map((screen) => (
              <div
                key={screen.title}
                className="group rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-1 hover:shadow-xl"
              >
                <div className="overflow-hidden rounded-[1.5rem]">
                  <Image
                    src={screen.image}
                    alt={screen.alt}
                    width={420}
                    height={820}
                    className="h-80 w-full object-cover transition duration-300 group-hover:scale-105"
                  />
                </div>

                <h3 className="mt-5 text-xl font-black">
                  {screen.title}
                </h3>

                <p className="mt-3 text-sm leading-7 text-slate-600">
                  {screen.text}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PROBLEM */}
      <section className="bg-slate-50 px-5 py-16">
        <div className="mx-auto max-w-6xl">
          <div className="text-center">
            <p className="text-sm font-black text-blue-600">
              INVESTOR PROBLEMS
            </p>

            <h2 className="mt-2 text-4xl font-black">
              株式投資でこんな悩みありませんか？
            </h2>
          </div>

          <div className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
            {problems.map((text) => (
              <div
                key={text}
                className="rounded-[2rem] bg-white p-7 shadow-sm transition hover:-translate-y-1 hover:shadow-lg"
              >
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-red-50 text-2xl">
                  ❓
                </div>

                <p className="text-lg font-black leading-8">
                  {text}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* SOLUTION */}
      <section className="px-5 py-16">
        <div className="mx-auto max-w-6xl">
          <div className="text-center">
            <p className="text-sm font-black text-blue-600">
              AI SOLUTION
            </p>

            <h2 className="mt-2 text-4xl font-black">
              SIGNALXがすべて解決します
            </h2>

            <p className="mx-auto mt-4 max-w-2xl text-sm leading-7 text-slate-600">
              AIが毎朝1000銘柄以上を分析。
              必要なのはランキングを見るだけです。
            </p>
          </div>

          <div className="mt-10 grid gap-6 md:grid-cols-2">
            {solutions.map(([title, text]) => (
              <div
                key={title}
                className="rounded-[2rem] border border-slate-200 bg-white p-8 shadow-sm transition hover:-translate-y-1 hover:shadow-lg"
              >
                <h3 className="text-2xl font-black">
                  {title}
                </h3>

                <p className="mt-4 text-sm leading-8 text-slate-600">
                  {text}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section className="bg-slate-50 px-5 py-16">
        <div className="mx-auto max-w-6xl">
          <div className="text-center">
            <p className="text-sm font-black text-blue-600">
              FEATURES
            </p>

            <h2 className="mt-2 text-4xl font-black">
              SIGNALXの主な機能
            </h2>
          </div>

          <div className="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {features.map(([icon, title, text]) => (
              <div
                key={title}
                className="rounded-[2rem] bg-white p-7 shadow-sm transition hover:-translate-y-1 hover:shadow-xl"
              >
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-3xl">
                  {icon}
                </div>

                <h3 className="mt-5 text-xl font-black">
                  {title}
                </h3>

                <p className="mt-3 text-sm leading-7 text-slate-600">
                  {text}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>
            {/* BETA */}
      <section className="px-5 py-16">
        <div className="mx-auto max-w-4xl rounded-[2.5rem] bg-slate-950 p-8 text-center text-white shadow-2xl shadow-slate-300 md:p-10">
          <p className="text-sm font-black text-blue-300">BETA RELEASE</p>

          <h2 className="mt-3 text-4xl font-black tracking-tight">
            SIGNALXは現在β版です
          </h2>

          <p className="mx-auto mt-5 max-w-2xl text-sm font-medium leading-8 text-slate-300">
            現在、AIランキング・AI分析・通知機能を中心に毎日アップデート中。
            利用者の声を反映しながら、より実用的な株式分析サービスへ育てています。
          </p>

          <Link
            href="/scan-mobile"
            className="mt-8 inline-flex rounded-full bg-white px-9 py-4 text-sm font-black text-slate-950 shadow-lg transition hover:-translate-y-0.5 hover:bg-blue-50"
          >
            SIGNALXを試す
          </Link>
        </div>
      </section>

      {/* PRICE */}
      <section className="bg-white px-5 py-16">
        <div className="mx-auto max-w-6xl">
          <div className="text-center">
            <p className="text-sm font-black text-blue-600">PRICE</p>

            <h2 className="mt-2 text-4xl font-black">
              料金プラン
            </h2>

            <p className="mx-auto mt-4 max-w-2xl text-sm leading-7 text-slate-600">
              β版は無料。正式版では通知・詳細分析・AI学習レポートを拡張予定です。
            </p>
          </div>

          <div className="mt-10 grid gap-6 md:grid-cols-2">
            <div className="rounded-[2rem] border border-slate-200 bg-white p-8 shadow-sm">
              <p className="text-sm font-black text-blue-600">β版</p>

              <h3 className="mt-3 text-5xl font-black">
                無料
              </h3>

              <p className="mt-5 text-sm leading-7 text-slate-600">
                現在はβ版として無料で利用できます。
                AIランキング・AI分析画面を自由に確認できます。
              </p>

              <Link
                href="/scan-mobile"
                className="mt-7 inline-flex rounded-full bg-blue-600 px-7 py-4 text-sm font-black text-white shadow-lg shadow-blue-100 transition hover:bg-blue-700"
              >
                無料ではじめる
              </Link>
            </div>

            <div className="rounded-[2rem] border border-blue-200 bg-blue-50 p-8 shadow-sm">
              <p className="text-sm font-black text-blue-700">正式版予定</p>

              <h3 className="mt-3 text-5xl font-black">
                月額980円〜
              </h3>

              <p className="mt-5 text-sm leading-7 text-slate-600">
                AI通知・詳細分析・実測勝率・AI進化履歴などを順次追加予定です。
                公開前に品質保証チェックを行います。
              </p>

              <Link
                href="/trust"
                className="mt-7 inline-flex rounded-full bg-slate-950 px-7 py-4 text-sm font-black text-white shadow-lg shadow-slate-200 transition hover:bg-blue-600"
              >
                AI品質を見る
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="px-5 py-16">
        <div className="mx-auto max-w-5xl rounded-[2.5rem] bg-gradient-to-br from-blue-600 to-emerald-500 p-8 text-center text-white shadow-2xl shadow-blue-200 md:p-12">
          <p className="text-sm font-black text-blue-100">START SIGNALX</p>

          <h2 className="mt-3 text-4xl font-black leading-tight tracking-tight md:text-5xl">
            まずは無料で、
            <br />
            今日のAIランキングを確認。
          </h2>

          <p className="mx-auto mt-5 max-w-2xl text-sm font-bold leading-8 text-white/85">
            1000銘柄以上をAIがスキャン。
            迷ったら、まずは上位ランキングから見るだけでOKです。
          </p>

          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Link
              href="/scan-mobile"
              className="rounded-full bg-white px-10 py-4 text-sm font-black text-blue-700 shadow-lg transition hover:-translate-y-0.5"
            >
              AIランキングを見る
            </Link>

            <Link
              href="/login"
              className="rounded-full border border-white/30 bg-white/10 px-10 py-4 text-sm font-black text-white backdrop-blur transition hover:-translate-y-0.5 hover:bg-white/20"
            >
              Googleログイン
            </Link>
          </div>
        </div>
      </section>

      {/* DISCLAIMER */}
      <section className="px-5 pb-12">
        <div className="mx-auto max-w-5xl rounded-[2rem] border border-amber-200 bg-amber-50 p-6">
          <h2 className="text-lg font-black text-amber-800">
            ご利用前の注意
          </h2>

          <p className="mt-3 text-sm font-medium leading-8 text-amber-900">
            SIGNALXは、投資判断をサポートするための情報提供サービスです。
            表示されるAI判定・ランキング・スコアは、将来の株価上昇や利益を保証するものではありません。
            最終的な投資判断はご自身の責任で行ってください。
          </p>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-slate-200 bg-white py-10">
        <div className="mx-auto max-w-6xl px-6 text-center">
          <h2 className="text-2xl font-black">
            SIGNAL<span className="text-blue-600">X</span>
          </h2>

          <p className="mt-3 text-sm font-bold text-slate-500">
            AIが1006銘柄を毎日分析する日本株AI分析サービス
          </p>

          <div className="mt-6 flex flex-wrap justify-center gap-6 text-sm font-bold">
            <Link
              href="/terms"
              className="text-slate-600 transition hover:text-blue-600"
            >
              利用規約
            </Link>

            <Link
              href="/privacy"
              className="text-slate-600 transition hover:text-blue-600"
            >
              プライバシーポリシー
            </Link>

            <Link
              href="/contact"
              className="text-slate-600 transition hover:text-blue-600"
            >
              お問い合わせ
            </Link>
          </div>

          <p className="mt-8 text-xs text-slate-400">
            © 2026 SIGNALX. All Rights Reserved.
          </p>
        </div>
      </footer>
    </main>
  );
}