"use client";

import Link from "next/link";
import Image from "next/image";
import { useSession } from "next-auth/react";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import BottomNav from "@/app/components/BottomNav";
import { isTodayMarketReady } from "./dashboardResilience";

type TodayMarketData = {
  success?: boolean;
  status?: string;
  stocks?: Stock[];
  grade: string;
  action: string;
  marketCondition: string;
  hotCount: number;
  watchCount?: number;
  topStock: { code: string; name: string; aiPower: number; expected: string; judge: string; } | null;
  updatedAt: string;
};

type LearningDashboard = { success: boolean; total: number; win: number; lose: number; hold: number; pending: number; winRate: number; previousWinRate: number; diff: number; growth: number; dateCount: number; updatedAt: string; };
type Stock = { code: string; name: string; score: number; price: number; changePercent?: number; rsi?: number; volumeRatio?: number; reason?: string; trend?: string; patternSignal?: string; patternScore?: number; takeProfit?: number; stopLoss?: number; };

function yen(value?: number | null) { if (value === undefined || value === null) return "-"; return `${Math.round(value).toLocaleString()}円`; }
function getRankLabel(score = 0) { if (score >= 95) return "👑 Sランク"; if (score >= 85) return "🥇 Aランク"; if (score >= 70) return "🥈 Bランク"; if (score >= 50) return "🥉 Cランク"; return "❌ Dランク"; }
function getPatternText(pattern?: string) { if (pattern === "W_BOTTOM_BREAK") return "Wボトム突破"; if (pattern === "W_BOTTOM") return "Wボトム候補"; return "通常"; }

export default function HomePage() {
  const router = useRouter();
  const { data: session } = useSession();
  const [marketData, setMarketData] = useState<TodayMarketData | null>(null);
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [loadingScan, setLoadingScan] = useState(true);
  const [searchText, setSearchText] = useState("");
  const [learningData, setLearningData] = useState<LearningDashboard | null>(null);
  const [loadingLearning, setLoadingLearning] = useState(true);
  const [learningError, setLearningError] = useState(false);

  useEffect(() => {
    let active = true;
    async function loadMarketData() { try { const r=await fetch("/api/today-market",{cache:"no-store"}); if(!r.ok) throw new Error(`today-market api error: ${r.status}`); const j:TodayMarketData=await r.json(); if(!active)return; const ready=isTodayMarketReady(r.status,j); setMarketData(j); setStocks(ready&&Array.isArray(j.stocks)?j.stocks:[]); } catch(e){console.error("dashboard market fetch error:",e);if(active){setMarketData(null);setStocks([])}} finally{if(active)setLoadingScan(false)} }
    async function loadLearningData(){try{const r=await fetch("/api/learning/dashboard",{cache:"no-store"});if(!r.ok)throw new Error(`learning dashboard api error: ${r.status}`);const j:LearningDashboard=await r.json();if(!active)return;setLearningError(false);setLearningData(j)}catch(e){console.error("dashboard learning fetch error:",e);if(active){setLearningError(true);setLearningData(null)}}finally{if(active)setLoadingLearning(false)}}
    void loadMarketData();void loadLearningData();return()=>{active=false};
  },[]);

  const aiSummary=useMemo(()=>({sRank:stocks.filter(s=>s.score>=95).length,buyCandidates:stocks.filter(s=>s.score>=85).length,wBottom:stocks.filter(s=>s.patternSignal==="W_BOTTOM_BREAK").length,volumeHot:stocks.filter(s=>(s.volumeRatio??1)>=2).length,topStock:stocks[0]}),[stocks]);

  return <main className="min-h-screen bg-[#f7f9fc] text-slate-900 pb-24"><div className="mx-auto max-w-md px-3 pt-2">
    <header className="flex items-center justify-between mb-3"><div><div className="text-3xl font-black tracking-tight">SIGNAL<span className="text-blue-600">X</span></div><div className="text-xs font-black tracking-[0.2em] text-slate-500">AI MARKET SYSTEM</div></div><div className="flex gap-2"><Link href="/alerts" className="relative w-10 h-10 rounded-xl bg-white shadow flex items-center justify-center text-lg">🔔<span className="absolute right-3 top-3 w-2 h-2 bg-red-500 rounded-full"/></Link><Link href="/mypage" className="h-11 rounded-2xl bg-white shadow flex items-center gap-2 px-2">{session?.user?.image?<img src={session.user.image} alt="User" className="w-8 h-8 rounded-full"/>:<span className="text-lg">👤</span>}</Link></div></header>
    <form onSubmit={e=>{e.preventDefault();const k=searchText.trim();if(k)router.push(`/analysis/${k}`)}} className="bg-white rounded-2xl shadow-sm border border-slate-200 px-3 py-2 mb-2 flex items-center gap-3"><span className="text-xl">🔍</span><input value={searchText} onChange={e=>setSearchText(e.target.value)} className="w-full outline-none text-sm font-bold placeholder:text-slate-400 bg-transparent" placeholder="銘柄コードを入力 例：9983"/><button type="submit" className="text-lg text-blue-600 font-black">→</button></form>
    <div className="mb-2 sm:mb-3"><p className="mb-2 text-sm font-black text-slate-600 sm:mb-3">予算から銘柄を探す</p><div className="grid grid-cols-4 gap-2 sm:grid-cols-2 sm:gap-3">{[[100000,"10万円以内","bg-emerald-500"],[300000,"30万円以内","bg-blue-500"],[500000,"50万円以内","bg-orange-500"],[1000000,"100万円以内","bg-purple-500"]].map(([b,t,c])=><Link key={String(b)} href={`/scan-mobile?budget=${b}`} className={`whitespace-nowrap rounded-xl ${c} px-1 py-2 text-center text-[11px] font-black text-white shadow sm:rounded-2xl sm:p-4 sm:text-base`}>💴<br className="hidden sm:block"/>{t}</Link>)}</div></div>
    <section className="rounded-2xl bg-gradient-to-br from-white to-blue-50 border border-blue-200 p-2.5 mb-2 shadow-sm sm:p-3"><Link href="/ai-analysis" className="block"><p className="text-sm font-black text-blue-600">🤖 今日のSIGNALX AI</p><h2 className="mt-1 text-2xl font-black sm:text-3xl">{loadingScan?"解析中...":"今日の市場総評"}</h2><p className="text-xs text-slate-500 font-bold mt-1">AIが今日の相場を総合判定</p><div className="mt-2 grid grid-cols-4 gap-1.5"><MiniStat label="Sランク" value={`${aiSummary.sRank}`} color="text-yellow-500"/><MiniStat label="買い候補" value={`${aiSummary.buyCandidates}`} color="text-green-600"/><MiniStat label="W突破" value={`${aiSummary.wBottom}`} color="text-blue-600"/><MiniStat label="出来高" value={`${aiSummary.volumeHot}`} color="text-purple-600"/></div>{aiSummary.topStock&&<div className="mt-2 rounded-xl bg-white/80 border border-blue-100 p-2.5"><div className="flex items-center justify-between"><div><p className="text-xs font-black text-slate-500">本日の注目</p><p className="text-xl font-black">{aiSummary.topStock.code} {aiSummary.topStock.name}</p><p className="text-xs font-bold text-slate-500 mt-1">{getPatternText(aiSummary.topStock.patternSignal)} / {getRankLabel(aiSummary.topStock.score)}</p></div><div className="text-right"><p className="text-xs font-black text-slate-500">AI</p><p className="text-4xl font-black text-blue-600">{aiSummary.topStock.score}</p></div></div><p className="mt-3 hidden text-sm font-bold leading-6 sm:block">{aiSummary.topStock.reason||"AI理由なし"}</p></div>}</Link></section>
    <Link href="/today-market" className="block rounded-xl border border-green-300 bg-gradient-to-br from-white to-green-50 px-3 py-2 mb-2 shadow-sm"><p className="text-sm font-black text-green-700">🤖 今日の市場</p><p className="text-sm font-bold text-slate-500">{marketData?.topStock&&marketData.status!=="loading"?`${marketData.action} / ${marketData.marketCondition}`:loadingScan?"今日の市場を解析中...":"本日の市場データを準備中です"}</p></Link>
    <Link href="/learning" className="block rounded-2xl border border-blue-200 bg-blue-50/70 p-3 mb-2 shadow-sm"><div className="flex justify-between"><h2 className="text-lg font-black">🧠 AI学習状況</h2><span className="text-sm font-black text-slate-500">詳細へ ›</span></div>{learningError?<div className="mt-3 rounded-xl bg-white/80 p-4 text-center text-sm font-black text-slate-500">学習状況を取得できませんでした</div>:<><div className="mt-3 grid grid-cols-4 gap-2"><MiniStat label="累計" value={loadingLearning?"--":(learningData?.total??0).toLocaleString()} color="text-blue-600"/><MiniStat label="WIN" value={loadingLearning?"--":(learningData?.win??0).toLocaleString()} color="text-green-600"/><MiniStat label="LOSE" value={loadingLearning?"--":(learningData?.lose??0).toLocaleString()} color="text-red-600"/><MiniStat label="観察中" value={loadingLearning?"--":(learningData?.hold??0).toLocaleString()} color="text-orange-500"/></div><div className="mt-2 flex justify-between gap-3 bg-white/80 rounded-xl px-3 py-2 text-xs font-bold"><span>学習日数 <b className="text-blue-600">{loadingLearning?"--":`${learningData?.dateCount??0}日`}</b></span><span>AI勝率 <b className="text-blue-600">{loadingLearning?"--":`${learningData?.winRate??0}%`}</b></span></div><div className="mt-2 flex items-center justify-between rounded-xl bg-white/60 px-3 py-2 text-[11px] font-bold text-slate-500"><span>判定済み {loadingLearning?"--":((learningData?.win??0)+(learningData?.lose??0)).toLocaleString()}件</span><span>判定予定 {loadingLearning?"--":(learningData?.pending??0).toLocaleString()}件</span></div></>}</Link>
    <section className="space-y-1.5 mb-2"><MenuCard href="/today-market" icon="📋" color="from-purple-500 to-pink-400" title="今日の市場" desc="相場の流れをAIが総括"/><MenuCard href="/ranking" icon="🏆" color="from-yellow-400 to-orange-400" title="AIランキング" desc="AI POWER上位100銘柄を確認"/><MenuCard href="/ai-analysis" icon="🧠" color="from-blue-600 to-indigo-400" title="AI分析" desc="AIの判断理由を詳しく確認"/><MenuCard href="/scan-mobile" icon="🔍" color="from-sky-500 to-cyan-400" title="銘柄スキャン" desc="1000銘柄を監視し注目銘柄を発見"/><MenuCard href="/alerts" icon="🔔" color="from-orange-500 to-yellow-400" title="AI通知" desc="買い時・利確・損切を通知"/><MenuCard href="/favorites" icon="⭐" color="from-yellow-400 to-orange-400" title="お気に入り" desc="登録銘柄を自動監視"/><MenuCard href="/learning" icon="📈" color="from-green-500 to-emerald-400" title="AI学習" desc="勝率・得意銘柄・成長を確認"/><MenuCard href="/result-stats" icon="📊" color="from-slate-400 to-slate-500" title="勝率検証" desc="AI判断の成績を公開"/><MenuCard href="/glossary" icon="📘" color="from-blue-500 to-cyan-400" title="かんたん用語集" desc="HOLD・AIスコア・投資用語をやさしく解説"/></section>
    <section className="space-y-3"><div className="rounded-2xl bg-white border border-slate-200 shadow-sm overflow-hidden"><div className="flex justify-between items-center px-4 py-3 border-b border-slate-100"><h2 className="font-black text-base">👑 今日のAI TOP5</h2><Link href="/ranking" className="text-xs text-slate-500 font-bold">もっと見る ›</Link></div>{loadingScan?<p className="px-4 py-5 text-sm font-bold text-slate-400">読み込み中...</p>:stocks.slice(0,5).map((stock,index)=><Link key={stock.code} href={`/analysis/${stock.code}`} className="flex items-center justify-between px-4 py-3 border-b border-slate-100 last:border-b-0"><div className="flex items-center gap-3"><div className={`w-9 h-9 rounded-lg flex items-center justify-center font-black text-white ${index<3?"bg-yellow-400":"bg-slate-300"}`}>{index+1}</div><div className="font-black">{stock.code} {stock.name}</div></div><div className="font-black text-blue-600">AI {stock.score}</div></Link>)}</div></section>
  </div><BottomNav/></main>;
}

function MiniStat({label,value,color}:{label:string;value:string;color:string}){return <div className="bg-white rounded-xl shadow-sm px-1.5 py-2 text-center"><p className="text-[10px] text-slate-500 font-black">{label}</p><p className={`text-sm sm:text-lg font-black leading-tight ${color}`}>{value}</p></div>}
function MenuCard({href,icon,color,title,desc}:{href:string;icon:string;color:string;title:string;desc:string}){return <Link href={href} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-3 flex items-center gap-3 active:scale-[0.99] transition"><div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${color} flex items-center justify-center text-2xl text-white shadow-sm`}>{icon}</div><div className="flex-1"><p className="text-lg font-black leading-tight">{title}</p><p className="text-xs text-slate-500 font-bold mt-1">{desc}</p></div><div className="text-slate-400 text-2xl font-black">›</div></Link>}
