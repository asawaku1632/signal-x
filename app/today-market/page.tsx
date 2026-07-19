"use client";

import Link from "next/link";
import { useEffect, useState } from "react";


   type TodayMarketData = {
  grade: string;
  action: string;
  marketCondition: string;
  hotCount: number;
  watchCount: number;
  top5: {
    rank: number;
    code: string;
    name: string;
    aiPower: number;
    price: number | null;
    changePercent: number | null;
    reason: string;
    expected: string;
  }[];
  topStock: {
    code: string;
    name: string;
    aiPower: number;
    expected: string;
    judge: string;
  };
  strategy: string[];
  avoid: string[];
  comment: string;
  updatedAt: string;
};

export default function TodayMarketPage() {
  const [marketData, setMarketData] = useState<TodayMarketData | null>(null);

  useEffect(() => {
    const loadMarket = async () => {
      try {
        const res = await fetch("/api/today-market", {
          cache: "no-store",
        });

        const data = await res.json();

        console.log("TODAY MARKET DATA:", data);

        setMarketData(data);
        console.log("SET DATA", data);
setMarketData(data);
      } catch (error) {
        console.error("today-market API error:", error);
      }
    };

    loadMarket();
  }, []);

  console.log("marketData =", marketData);

  if (!marketData) {
    return (
      <main className="min-h-screen bg-[#f7f9fc] text-slate-900 pb-24">
        <div className="mx-auto max-w-md px-4 pt-6">
          <div className="rounded-2xl bg-white border border-slate-200 p-5 shadow-sm">
            <p className="font-bold text-slate-500">
              今日の市場を読み込み中...
            </p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f7f9fc] text-slate-900 pb-24">
      <div className="mx-auto max-w-md px-4 pt-4">
        <header className="flex items-center justify-between mb-4">
          <Link
            href="/scan-mobile"
            className="w-11 h-11 rounded-2xl bg-white shadow flex items-center justify-center text-2xl"
          >
            ‹
          </Link>

          <div className="text-center">
            <div className="text-3xl font-black tracking-tight">
              SIGNAL<span className="text-blue-600">X</span>
            </div>
            <div className="text-xs font-black tracking-[0.22em] text-slate-500">
              AI MARKET SYSTEM
            </div>
          </div>

          <button className="relative w-11 h-11 rounded-2xl bg-white shadow flex items-center justify-center text-lg">
            🔔
            <span className="absolute right-3 top-3 w-2 h-2 bg-red-500 rounded-full" />
          </button>
        </header>

        <section className="mb-3">
          <div className="flex items-end justify-between gap-3">
            <div>
              <h1 className="text-3xl font-black leading-tight">
                🤖 今日の市場
              </h1>
              <p className="text-sm text-slate-500 mt-1">
                AIが本日の相場を分析しました
              </p>
            </div>

            <p className="text-xs text-slate-400 font-bold whitespace-nowrap">
              更新 {marketData.updatedAt}
            </p>
          </div>
        </section>

        <section className="relative overflow-hidden rounded-[22px] border border-green-400 bg-gradient-to-br from-white to-green-50 p-4 mb-4 shadow-sm">
          <div className="absolute right-0 bottom-0 text-green-200 text-8xl opacity-35">
            📈
          </div>

          <div className="relative grid grid-cols-[42%_58%] gap-2 items-center">
            <div>
              <p className="text-sm font-black mb-1">AI市場評価</p>

              <div className="text-[64px] leading-none font-black text-green-600">
                {marketData.grade}
              </div>

              <div className="mt-2 inline-flex items-center gap-2 rounded-full bg-green-100 px-3 py-2 text-green-700 font-black text-sm">
                <span>市場状況</span>
                <span>●</span>
                <span>{marketData.marketCondition}</span>
              </div>
            </div>

            <div className="pl-2">
              <div className="text-2xl font-black text-green-700 mb-2">
                📈 {marketData.action}
              </div>
              <p className="text-sm leading-6 font-bold">
                今日は買い候補を探してよい相場です。
                ただし高値追いは避けましょう
              </p>
            </div>
          </div>
        </section>

        <section className="grid grid-cols-2 gap-3 mb-4">
          <InfoCard
  icon="🔥"
  title="激熱候補"
  value={String(marketData.hotCount)}
  sub="75点以上"
  green
/>

<InfoCard
  icon="👀"
  title="注目候補"
  value={String(marketData.watchCount)}
  sub="65〜74点"
  green
/>

<InfoCard
  icon="⭐"
  title="本日の大本命"
  value={marketData.topStock.code}
  sub={marketData.topStock.name}
/>

<InfoCard
  icon="📈"
  title="市場状況"
  value={marketData.marketCondition}
  sub="AI総合判定"
  green
/>
        </section>

        <section className="rounded-[22px] border border-green-300 bg-gradient-to-br from-white to-green-50 p-4 mb-4 shadow-sm">
          <div className="flex justify-between items-start mb-3">
            <div>
              <p className="inline-block bg-green-100 text-green-700 text-sm font-black px-3 py-1 rounded-lg mb-2">
                本日の大本命
              </p>

              <div className="flex items-end gap-3">
                <p className="text-[42px] leading-none font-black">
                  {marketData.topStock.code}
                </p>
                <div>
                  <p className="text-2xl font-black leading-tight">
                    {marketData.topStock.name}
                  </p>
                  <p className="text-xs text-slate-500 font-bold">
                    東証プライム
                  </p>
                </div>
              </div>
            </div>

            <button className="text-3xl text-slate-300">☆</button>
          </div>

          <div className="grid grid-cols-3 bg-white rounded-2xl border border-slate-100 overflow-hidden mb-3">
            <div className="p-3 text-center border-r border-slate-100">
              <p className="text-xs font-black">AI POWER</p>
              <div className="mx-auto mt-2 w-16 h-16 rounded-full border-[8px] border-green-500 flex items-center justify-center">
                <p className="text-2xl font-black text-green-600">
                  {marketData.topStock.aiPower}
                </p>
              </div>
              <p className="text-xs text-slate-400">/100</p>
            </div>

            <div className="p-3 text-center border-r border-slate-100">
              <p className="text-xs font-black">期待値</p>
              <p className="text-3xl leading-none font-black text-green-600 mt-5">
                {marketData.topStock.expected}
              </p>
              <p className="inline-block mt-2 bg-green-50 text-green-700 rounded-md px-2 py-1 text-xs font-black">
                高い上昇期待
              </p>
            </div>

            <div className="p-3 text-center">
              <p className="text-xs font-black">推奨</p>
              <div className="mt-6 rounded-full bg-green-600 text-white font-black py-2 text-sm">
                🟢 {marketData.topStock.judge}
              </div>
            </div>
          </div>

          <Link
            href={`/analysis/${marketData.topStock.code}`}
            className="block rounded-xl border border-green-500 bg-white py-3 text-center text-green-700 font-black"
          >
            詳細分析を見る　→
          </Link>
        </section>

        <section className="rounded-[22px] bg-white border border-slate-100 shadow-sm p-4 mb-4">
          <h2 className="text-xl font-black mb-3">🎯 今日の戦略</h2>

          <div className="grid grid-cols-2 gap-3 text-sm font-black">
            <div className="space-y-3">
              {marketData.strategy.map((item) => (
                <p key={item} className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-green-500 text-white flex items-center justify-center">
                    ✓
                  </span>
                  {item}
                </p>
              ))}
            </div>

            <div className="space-y-3">
              {marketData.avoid.map((item) => (
                <p key={item} className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-red-500 text-white flex items-center justify-center">
                    ×
                  </span>
                  {item}
                </p>
              ))}
            </div>
          </div>
        </section>
<section className="rounded-[22px] bg-white border border-slate-100 shadow-sm p-4 mb-4">
  <div className="flex items-center justify-between mb-3">
    <h2 className="text-xl font-black">🏆 AIランキング TOP5</h2>
    <span className="text-xs font-bold text-slate-500">
      AI POWER順
    </span>
  </div>

  <div className="space-y-3">
    {marketData.top5.map((stock) => (
      <Link
        key={stock.code}
        href={`/analysis/${stock.code}`}
        className="flex items-center gap-3 rounded-2xl bg-slate-50 border border-slate-100 p-3 active:scale-[0.98] transition"
      >
        <div className="w-8 h-8 rounded-xl bg-yellow-400 text-white font-black flex items-center justify-center">
          {stock.rank}
        </div>

        <div className="flex-1 min-w-0">
          <div className="font-black text-sm">
            {stock.code} {stock.name}
          </div>
          <div className="text-xs text-slate-500 font-bold truncate">
            {stock.reason}
          </div>
        </div>

        <div className="text-right">
          <div className="text-green-600 font-black text-lg">
            {stock.aiPower}
          </div>
          <div className="text-xs text-slate-500 font-bold">
            {stock.expected}
          </div>
        </div>

        <div className="text-slate-400 text-xl">›</div>
      </Link>
    ))}
  </div>
</section>
        <section className="rounded-[22px] bg-blue-50 border border-blue-200 p-4 mb-4 shadow-sm">
          <h2 className="text-xl font-black mb-3">💬 AIコメント</h2>
          <p className="text-sm leading-7 font-bold">
            {marketData.comment}
          </p>
        </section>
      </div>

      <BottomNav />
    </main>
  );
}

function InfoCard({
  icon,
  title,
  value,
  sub,
  green,
}: {
  icon: string;
  title: string;
  value: string;
  sub: string;
  green?: boolean;
}) {
  return (
    <div className="rounded-2xl bg-white border border-slate-100 shadow-sm py-4 text-center">
      <p className="text-sm font-black">
        {icon} {title}
      </p>
      <p
        className={`text-3xl font-black mt-2 leading-none ${
          green ? "text-green-600" : "text-slate-900"
        }`}
      >
        {value}
      </p>
      <p className="text-xs text-slate-500 font-bold mt-1">{sub}</p>
    </div>
  );
}

function BottomNav() {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-slate-200">
      <div className="mx-auto max-w-md grid grid-cols-5 py-2">
      <Nav href="/dashboard" icon="🏠" label="ホーム" />
      <Nav href="/today-market" icon="🤖" label="市場" active />
      <Nav href="/ranking" icon="🏆" label="ランキング" />
      <Nav href="/learning" icon="🧠" label="学習" />
      <Nav href="/favorites" icon="⭐" label="お気に入り" />
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
      className={active ? "text-center text-xs font-bold text-blue-600" : "text-center text-xs font-bold text-slate-500"}
    >
      <div className="text-2xl">{icon}</div>
      {label}
    </Link>
  );
}



