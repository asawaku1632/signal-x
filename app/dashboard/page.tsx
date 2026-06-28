"use client";


import Link from "next/link";
import Image from "next/image";
import { useSession } from "next-auth/react";
import { useEffect, useMemo, useState } from "react";



type TodayMarketData = {

  grade: string;

  action: string;

  marketCondition: string;

  hotCount: number;

  watchCount?: number;

  topStock: {

    code: string;

    name: string;

    aiPower: number;

    expected: string;

    judge: string;

  };

  updatedAt: string;

};



type Stock = {

  code: string;

  name: string;

  score: number;

  price: number;

  changePercent?: number;

  rsi?: number;

  volumeRatio?: number;

  reason?: string;

  trend?: string;

  patternSignal?: string;

  patternScore?: number;

  takeProfit?: number;

  stopLoss?: number;

};



function yen(value?: number | null) {

  if (value === undefined || value === null) return "-";

  return `${Math.round(value).toLocaleString()}円`;

}



function getRankLabel(score = 0) {

  if (score >= 95) return "👑 Sランク";

  if (score >= 85) return "🥇 Aランク";

  if (score >= 70) return "🥈 Bランク";

  if (score >= 50) return "🥉 Cランク";

  return "❌ Dランク";

}



function getPatternText(pattern?: string) {

  if (pattern === "W_BOTTOM_BREAK") return "Wボトム突破";

  if (pattern === "W_BOTTOM") return "Wボトム候補";

  return "通常";

}



export default function HomePage() {
  const { data: session } = useSession();

  const [marketData, setMarketData] = useState<TodayMarketData | null>(null);

  const [stocks, setStocks] = useState<Stock[]>([]);

  const [loadingScan, setLoadingScan] = useState(true);



  useEffect(() => {

    fetch("/api/today-market", { cache: "no-store" })

      .then((res) => res.json())

      .then((data) => setMarketData(data))

      .catch(console.error);



    fetch("/api/scan?limit=20", { cache: "no-store" })

      .then((res) => res.json())

      .then((json) => {

        const list: Stock[] = Array.isArray(json)

          ? json

          : Array.isArray(json.stocks)

          ? json.stocks

          : [];



        setStocks(list);

      })

      .catch(console.error)

      .finally(() => setLoadingScan(false));

  }, []);



  const aiSummary = useMemo(() => {

    const sRank = stocks.filter((stock) => stock.score >= 95).length;

    const buyCandidates = stocks.filter((stock) => stock.score >= 85).length;

    const wBottom = stocks.filter(

      (stock) => stock.patternSignal === "W_BOTTOM_BREAK"

    ).length;

    const volumeHot = stocks.filter(

      (stock) => (stock.volumeRatio ?? 1) >= 2

    ).length;



    const topStock = stocks[0];



    return {

      sRank,

      buyCandidates,

      wBottom,

      volumeHot,

      topStock,

    };

  }, [stocks]);



  return (

    <main className="min-h-screen bg-[#f7f9fc] text-slate-900 pb-24">

      <div className="mx-auto max-w-md px-4 pt-4">

        <header className="flex items-center justify-between mb-3">

          <div>

            <div className="text-4xl font-black tracking-tight">

              SIGNAL<span className="text-blue-600">X</span>

            </div>

            <div className="text-xs font-black tracking-[0.2em] text-slate-500">

              AI MARKET SYSTEM

            </div>

          </div>



          <div className="flex gap-2">

            <Link

              href="/alerts"

              className="relative w-11 h-11 rounded-2xl bg-white shadow flex items-center justify-center text-lg"

            >

              🔔

              <span className="absolute right-3 top-3 w-2 h-2 bg-red-500 rounded-full" />

            </Link>



            <Link
  href="/mypage"
  className="h-11 rounded-2xl bg-white shadow flex items-center gap-2 px-2"
>
  {session?.user?.image ? (
    <Image
      src={session.user.image}
      alt="User"
      width={32}
      height={32}
      className="rounded-full"
    />
  ) : (
    <span className="text-lg">👤</span>
  )}
</Link>
          </div>

        </header>



        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 px-4 py-3 mb-3 flex items-center gap-3">

          <span className="text-xl">🔍</span>

          <input

            className="w-full outline-none text-sm font-bold placeholder:text-slate-400 bg-transparent"

            placeholder="銘柄名・コードを検索"

          />

          <span className="text-lg text-slate-500">⌗</span>

        </div>



        <Link

          href="/ai-analysis"

          className="block rounded-[24px] bg-gradient-to-br from-white to-blue-50 border border-blue-200 p-4 mb-3 shadow-sm"

        >

          <div className="flex items-start justify-between">

            <div>

              <p className="text-sm font-black text-blue-600">

                🤖 今日のSIGNALX AI

              </p>

              <h2 className="text-3xl font-black mt-2">

                {loadingScan ? "解析中..." : "今日の市場総評"}

              </h2>

              <p className="text-xs text-slate-500 font-bold mt-1">

                AIが今日の相場を総合判定

              </p>

            </div>

          </div>



          <div className="grid grid-cols-4 gap-2 mt-4">

            <MiniStat

              label="Sランク"

              value={`${aiSummary.sRank}`}

              color="text-yellow-500"

            />

            <MiniStat

              label="買い候補"

              value={`${aiSummary.buyCandidates}`}

              color="text-green-600"

            />

            <MiniStat

              label="W突破"

              value={`${aiSummary.wBottom}`}

              color="text-blue-600"

            />

            <MiniStat

              label="出来高"

              value={`${aiSummary.volumeHot}`}

              color="text-purple-600"

            />

          </div>



          {aiSummary.topStock && (

            <div className="mt-3 rounded-2xl bg-white/80 border border-blue-100 p-3">

              <div className="flex items-center justify-between">

                <div>

                  <p className="text-xs font-black text-slate-500">

                    本日の注目

                  </p>

                  <p className="text-xl font-black">

                    {aiSummary.topStock.code} {aiSummary.topStock.name}

                  </p>

                  <p className="text-xs font-bold text-slate-500 mt-1">

                    {getPatternText(aiSummary.topStock.patternSignal)} /{" "}

                    {getRankLabel(aiSummary.topStock.score)}

                  </p>

                </div>



                <div className="text-right">

                  <p className="text-xs font-black text-slate-500">AI</p>

                  <p className="text-4xl font-black text-blue-600">

                    {aiSummary.topStock.score}

                  </p>

                </div>

              </div>



              <p className="mt-3 text-sm font-bold leading-6">

                {aiSummary.topStock.reason || "AI理由なし"}

              </p>

            </div>

          )}

        </Link>



        <Link

          href="/today-market"

          className="block rounded-2xl border border-green-300 bg-gradient-to-br from-white to-green-50 px-4 py-3 mb-3 shadow-sm"

        >

          {marketData ? (

            <>

              <div className="flex items-center justify-between">

                <div className="flex items-center gap-3">

                  <div className="text-5xl font-black text-green-600 leading-none">

                    {marketData.grade}

                  </div>



                  <div>

                    <p className="text-sm font-black text-green-700">

                      🤖 今日の市場

                    </p>

                    <p className="text-xl font-black text-green-700 leading-tight">

                      {marketData.action}

                    </p>

                    <p className="text-xs text-slate-500 font-bold">

                      {marketData.marketCondition} / 激熱{marketData.hotCount}

                      銘柄

                    </p>

                  </div>

                </div>



                <div className="text-right">

                  <p className="text-[11px] text-slate-400 font-bold">

                    {marketData.updatedAt}

                  </p>

                  <p className="text-xs font-black mt-1">本命</p>

                  <p className="text-2xl font-black">

                    {marketData.topStock.code}

                  </p>

                </div>

              </div>



              <div className="mt-2 flex justify-between items-center rounded-xl bg-white/80 px-3 py-2 text-xs font-black">

                <span>{marketData.topStock.name}</span>

                <span className="text-green-700">詳細へ ›</span>

              </div>

            </>

          ) : (

            <p className="text-sm font-bold text-slate-500">

              今日の市場を読み込み中...

            </p>

          )}

        </Link>



        <Link

          href="/learning"

          className="block rounded-2xl bg-blue-50 border border-blue-100 px-3 py-3 mb-3 shadow-sm"

        >

          <div className="flex items-center justify-between mb-2">

            <h2 className="text-base font-black">🧠 AI学習状況</h2>

            <p className="text-xs text-slate-500 font-bold">詳細へ ›</p>

          </div>



          <div className="grid grid-cols-4 gap-2">

            <MiniStat label="学習" value="962" color="text-blue-600" />

            <MiniStat label="WIN" value="0" color="text-slate-900" />

            <MiniStat label="LOSE" value="1" color="text-red-500" />

            <MiniStat label="HOLD" value="961" color="text-slate-900" />

          </div>



          <div className="mt-2 flex justify-between bg-white/80 rounded-xl px-3 py-1.5 text-xs font-bold">

            <span>

              学習日数 <b className="text-blue-600">1日</b>

            </span>

            <span>

              AI勝率 <b className="text-blue-600">0%</b>

            </span>

          </div>

        </Link>



        <section className="space-y-2 mb-3">

          <MenuCard

            href="/today-market"

            icon="📋"

            color="from-purple-500 to-pink-400"

            title="今日の市場"

            desc="相場の流れをAIが総括"

          />



          <MenuCard

            href="/ranking"

            icon="🏆"

            color="from-yellow-400 to-orange-400"

            title="AIランキング"

            desc="AI POWER上位100銘柄を確認"

          />



          <MenuCard

            href="/ai-analysis"

            icon="🧠"

            color="from-blue-600 to-indigo-400"

            title="AI分析"

            desc="AIの判断理由を詳しく確認"

          />



          <MenuCard

            href="/scan-mobile"

            icon="🔍"

            color="from-blue-500 to-cyan-400"

            title="銘柄スキャン"

            desc="1000銘柄を監視し注目銘柄を発見"

          />



          <MenuCard

            href="/alerts"

            icon="🔔"

            color="from-orange-500 to-yellow-400"

            title="AI通知"

            desc="買い時・利確・損切を通知"

          />



          <MenuCard

            href="/favorites"

            icon="⭐"

            color="from-yellow-400 to-orange-400"

            title="お気に入り"

            desc="登録銘柄を自動監視"

          />



          <MenuCard

            href="/learning"

            icon="📈"

            color="from-green-500 to-emerald-400"

            title="AI学習"

            desc="勝率・得意銘柄・成長を確認"

          />



          <MenuCard

            href="/result-stats"

            icon="📊"

            color="from-slate-400 to-slate-500"

            title="勝率検証"

            desc="AI判断の成績を公開"

          />

        </section>



        <section className="space-y-3">

          <div className="rounded-2xl bg-white border border-slate-200 shadow-sm overflow-hidden">

            <div className="flex justify-between items-center px-4 py-3 border-b border-slate-100">

              <h2 className="font-black text-base">👑 今日のAI TOP5</h2>

              <Link href="/ranking" className="text-xs text-slate-500 font-bold">

                もっと見る ›

              </Link>

            </div>



            {stocks.slice(0, 5).map((stock, index) => (

              <Winner

                key={stock.code}

                rank={`${index + 1}`}

                code={stock.code}

                name={stock.name}

                win={`${stock.score}`}

                gray={index >= 3}

              />

            ))}

          </div>

        </section>

      </div>



      <BottomNav />

    </main>

  );

}



function MiniStat({

  label,

  value,

  color,

}: {

  label: string;

  value: string;

  color: string;

}) {

  return (

    <div className="bg-white rounded-xl py-2 text-center shadow-sm">

      <p className="text-[10px] font-black mb-1">{label}</p>

      <p className={`text-xl font-black leading-none ${color}`}>{value}</p>

    </div>

  );

}



function MenuCard({

  href,

  icon,

  color,

  title,

  desc,

}: {

  href: string;

  icon: string;

  color: string;

  title: string;

  desc: string;

}) {

  return (

    <Link

      href={href}

      className="bg-white rounded-2xl border border-slate-200 shadow-sm px-4 py-3 flex items-center gap-3 min-h-[72px]"

    >

      <div

        className={`w-11 h-11 rounded-full bg-gradient-to-br ${color} flex items-center justify-center text-xl shrink-0`}

      >

        {icon}

      </div>



      <div className="flex-1 min-w-0">

        <h3 className="text-lg font-black leading-tight">{title}</h3>

        <p className="text-xs text-slate-500 font-bold leading-4 mt-1">

          {desc}

        </p>

      </div>



      <span className="text-2xl text-slate-400">›</span>

    </Link>

  );

}



function Winner({

  rank,

  code,

  name,

  win,

  gray,

}: {

  rank: string;

  code: string;

  name: string;

  win: string;

  gray?: boolean;

}) {

  return (

    <Link

      href={`/analysis/${code}`}

      className="flex items-center gap-3 px-4 py-3 border-b border-slate-100"

    >

      <span

        className={`w-7 h-7 rounded-lg flex items-center justify-center text-white text-xs font-black ${

          gray ? "bg-slate-300" : "bg-yellow-400"

        }`}

      >

        {rank}

      </span>



      <div className="font-black text-sm flex-1">

        {code} {name}

      </div>



      <div className="text-sm text-blue-600 font-black">AI {win}</div>

    </Link>

  );

}



function BottomNav() {

  return (

    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200">

      <div className="mx-auto max-w-md grid grid-cols-5 py-2">

        <Nav href="/" icon="🏠" label="ホーム" active />

        <Nav href="/ranking" icon="🏆" label="ランキング" />

        <Nav href="/alerts" icon="🔔" label="通知" />

        <Nav href="/favorites" icon="⭐" label="お気に入り" />

        <Nav href="/ai-analysis" icon="🧠" label="AI分析" />

      </div>

    </nav>

  );

}



function Nav({

  href,

  icon,

  label,

  active,

}: {

  href: string;

  icon: string;

  label: string;

  active?: boolean;

}) {

  return (

    <Link

      href={href}

      className={`text-center text-xs font-bold ${

        active ? "text-yellow-500" : "text-slate-500"

      }`}

    >

      <div className="text-2xl">{icon}</div>

      {label}

    </Link>

  );

}