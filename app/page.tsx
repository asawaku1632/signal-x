import Link from "next/link";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-white text-slate-900">
      {/* HERO */}
      <section className="relative overflow-hidden bg-gradient-to-b from-blue-50 via-white to-white px-5 py-12 text-center">
        <div className="mx-auto max-w-4xl">
          <p className="mb-4 inline-block rounded-full bg-blue-100 px-4 py-2 text-sm font-bold text-blue-700">
            SIGNALX β版 公開中
          </p>

          <h1 className="text-4xl font-extrabold leading-tight md:text-6xl">
            日本株1006銘柄を
            <br />
            AIが毎日分析。
          </h1>

          <p className="mt-5 text-lg font-bold text-slate-700 md:text-2xl">
            あなたが見るべき銘柄だけを、
            <br />
            SIGNALXが見つけます。
          </p>

          <p className="mx-auto mt-5 max-w-2xl text-sm leading-7 text-slate-600 md:text-base">
            EMA・VWAP・MACD・RSIなど複数の指標をAIが総合判定。
            初心者でも迷わず使える株式分析サービスです。
          </p>

          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Link
              href="/scan-mobile"
              className="rounded-full bg-blue-600 px-8 py-4 text-sm font-extrabold text-white shadow-lg shadow-blue-200"
            >
              無料で試してみる
            </Link>

            <Link
              href="/ranking"
              className="rounded-full border border-slate-300 bg-white px-8 py-4 text-sm font-extrabold text-slate-800 shadow-sm"
            >
              AIランキングを見る
            </Link>
          </div>
        </div>
      </section>

      {/* TODAY STATUS */}
      <section className="px-5 py-8">
        <div className="mx-auto max-w-5xl rounded-3xl border bg-white p-5 shadow-sm">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <p className="text-sm font-bold text-blue-600">今日のSIGNALX</p>
              <h2 className="text-2xl font-extrabold">AI市場スキャン状況</h2>
            </div>
            <span className="rounded-full bg-green-100 px-4 py-2 text-sm font-bold text-green-700">
              🟢 強気
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
            {[
              ["1006", "監視銘柄"],
              ["952", "取得済み"],
              ["40", "激熱候補"],
              ["158", "本命候補"],
              ["V3", "AI POWER"],
            ].map(([num, label]) => (
              <div key={label} className="rounded-2xl bg-slate-50 p-4 text-center">
                <p className="text-3xl font-extrabold">{num}</p>
                <p className="mt-1 text-xs font-bold text-slate-500">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* SCREEN PREVIEW */}
      <section className="px-5 py-10">
        <div className="mx-auto max-w-5xl">
          <div className="text-center">
            <p className="text-sm font-bold text-blue-600">SCREEN</p>
            <h2 className="mt-2 text-3xl font-extrabold">実際の画面</h2>
            <p className="mt-3 text-sm text-slate-600">
              AIランキング・AI分析・リアルチャートをスマホで確認できます。
            </p>
          </div>

          <div className="mt-7 grid gap-4 md:grid-cols-3">
            {[
              ["📱 AIランキング", "1006銘柄からAIが注目銘柄を抽出"],
              ["📊 AI分析", "EMA・VWAP・MACDをAIが解説"],
              ["📈 リアルチャート", "チャートとテクニカル指標を確認"],
            ].map(([title, text]) => (
              <div key={title} className="rounded-3xl border bg-slate-50 p-5">
                <div className="flex h-64 items-center justify-center rounded-2xl bg-white text-center text-slate-400">
                  <div>
                    <p className="text-4xl">画像</p>
                    <p className="mt-2 text-xs">スクリーンショット予定</p>
                  </div>
                </div>
                <h3 className="mt-4 font-extrabold">{title}</h3>
                <p className="mt-2 text-sm text-slate-600">{text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PROBLEM */}
      <section className="bg-slate-50 px-5 py-12">
        <div className="mx-auto max-w-5xl">
          <div className="text-center">
            <p className="text-sm font-bold text-blue-600">PROBLEM</p>
            <h2 className="mt-2 text-3xl font-extrabold">
              株式投資でこんな悩みありませんか？
            </h2>
          </div>

          <div className="mt-7 grid gap-4 md:grid-cols-4">
            {[
              "何を買えばいいか分からない",
              "チャートが難しい",
              "毎日1000銘柄も見られない",
              "売買判断に迷う",
            ].map((text) => (
              <div key={text} className="rounded-2xl bg-white p-5 font-bold shadow-sm">
                ✅ {text}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* SOLUTION */}
      <section className="px-5 py-12">
        <div className="mx-auto max-w-5xl">
          <div className="text-center">
            <p className="text-sm font-bold text-blue-600">SOLUTION</p>
            <h2 className="mt-2 text-3xl font-extrabold">
              SIGNALXがAIでサポートします
            </h2>
          </div>

          <div className="mt-7 grid gap-4 md:grid-cols-2">
            {[
              ["🤖 1006銘柄をAI分析", "毎日多数の日本株をAIが自動でチェックします。"],
              ["📈 注目銘柄をランキング化", "スコアの高い銘柄を分かりやすく表示します。"],
              ["📊 複数指標を総合判定", "EMA・VWAP・MACD・RSIなどをAIが総合評価します。"],
              ["💬 初心者向けに解説", "難しい指標を、行動しやすい言葉で表示します。"],
            ].map(([title, text]) => (
              <div key={title} className="rounded-3xl border p-6">
                <h3 className="text-lg font-extrabold">{title}</h3>
                <p className="mt-3 text-sm leading-7 text-slate-600">{text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section className="bg-slate-50 px-5 py-12">
        <div className="mx-auto max-w-5xl">
          <div className="text-center">
            <p className="text-sm font-bold text-blue-600">FEATURES</p>
            <h2 className="mt-2 text-3xl font-extrabold">主な機能</h2>
          </div>

          <div className="mt-7 grid gap-4 md:grid-cols-3">
            {[
              ["🤖 AI POWER", "AIが銘柄の強さをスコア化"],
              ["📈 AIランキング", "注目銘柄をランキング表示"],
              ["📊 テクニカル分析", "EMA・VWAP・MACD・RSIに対応"],
              ["🔔 LINE通知", "重要な銘柄情報を通知"],
              ["📱 スマホ対応", "毎朝スマホで確認しやすい画面"],
              ["💬 AIコメント", "初心者向けに分かりやすく解説"],
            ].map(([title, text]) => (
              <div key={title} className="rounded-2xl bg-white p-5 shadow-sm">
                <h3 className="font-extrabold">{title}</h3>
                <p className="mt-2 text-sm text-slate-600">{text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* BETA */}
      <section className="px-5 py-12">
        <div className="mx-auto max-w-3xl rounded-3xl bg-blue-600 p-8 text-center text-white shadow-lg shadow-blue-200">
          <h2 className="text-3xl font-extrabold">SIGNALXは現在β版です</h2>
          <p className="mt-4 text-sm leading-7 text-blue-50">
            現在、AIランキング・AI分析・通知機能を中心に毎日アップデート中。
            利用者の声を反映しながら、より実用的な株式分析サービスへ育てています。
          </p>

          <Link
            href="/scan-mobile"
            className="mt-7 inline-block rounded-full bg-white px-8 py-4 text-sm font-extrabold text-blue-600"
          >
            SIGNALXを試す
          </Link>
        </div>
      </section>

      {/* PRICE */}
      <section className="bg-slate-50 px-5 py-12">
        <div className="mx-auto max-w-5xl">
          <div className="text-center">
            <p className="text-sm font-bold text-blue-600">PRICE</p>
            <h2 className="mt-2 text-3xl font-extrabold">料金プラン</h2>
          </div>

          <div className="mt-7 grid gap-4 md:grid-cols-2">
            <div className="rounded-3xl border bg-white p-7 shadow-sm">
              <p className="text-sm font-bold text-blue-600">β版</p>
              <h3 className="mt-2 text-4xl font-extrabold">無料</h3>
              <p className="mt-4 text-sm text-slate-600">
                現在はβ版として無料で利用できます。
              </p>
            </div>

            <div className="rounded-3xl border border-blue-200 bg-blue-50 p-7 shadow-sm">
              <p className="text-sm font-bold text-blue-600">正式版予定</p>
              <h3 className="mt-2 text-4xl font-extrabold">月額980円〜</h3>
              <p className="mt-4 text-sm text-slate-600">
                AI通知・詳細分析・実測勝率などを順次追加予定です。
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* DISCLAIMER */}
      <section className="px-5 py-10">
        <div className="mx-auto max-w-4xl rounded-2xl border border-amber-200 bg-amber-50 p-5">
          <h2 className="text-lg font-extrabold text-amber-800">
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