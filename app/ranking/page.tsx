"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { DetectedChartPattern } from "@/app/lib/chartPatternEngine";
import { hasChartPatternCatalogItem } from "@/app/lib/chartPatternCatalog";
import BottomNav from "@/app/components/BottomNav";

type Stock = {
  code: string;
  name: string;
  score: number;
  rawAiPower?: number;
  price: number;
  changePercent?: number;
  volumeRatio?: number;
  reason?: string;
  winRate?: number;
  judgedCount?: number;
  wins?: number;
  losses?: number;
  holds?: number;
  totalProfitYen?: number;
  expectedProfitRate?: number;
  expectedProfitAmount?: number;
  reliabilityScore?: number;
  detectedPatterns?: DetectedChartPattern[];
};

type SortMode = "score" | "winRate" | "expectedProfit" | "capital" | "change" | "reliability";
type BudgetMode = "all" | "10000" | "50000" | "100000" | "300000" | "500000";

const BUDGET_OPTIONS: { value: BudgetMode; label: string }[] = [
  { value: "all", label: "制限なし" }, { value: "10000", label: "1万円" },
  { value: "50000", label: "5万円" }, { value: "100000", label: "10万円" },
  { value: "300000", label: "30万円" }, { value: "500000", label: "50万円" },
];
const SORT_OPTIONS: { value: SortMode; label: string }[] = [
  { value: "score", label: "AI POWER" }, { value: "winRate", label: "勝率" },
  { value: "expectedProfit", label: "期待利益" }, { value: "capital", label: "必要資金" },
  { value: "change", label: "上昇率" }, { value: "reliability", label: "信頼度" },
];

function num(v: unknown, fallback = 0) {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") { const n = Number(v.replace(/[%円,+,\s]/g, "")); if (Number.isFinite(n)) return n; }
  return fallback;
}
function opt(v: unknown) { if (v === undefined || v === null || v === "") return undefined; const n = num(v, Number.NaN); return Number.isNaN(n) ? undefined : n; }
function yen(v?: number) { return v === undefined || Number.isNaN(v) ? "--" : `${Math.round(v).toLocaleString()}円`; }
function signedYen(v?: number) { if (v === undefined || Number.isNaN(v)) return "--"; const n = Math.round(v); return `${n > 0 ? "+" : ""}${n.toLocaleString()}円`; }
function percent(v?: number, digits = 1) { return v === undefined || Number.isNaN(v) ? "--" : `${v > 0 ? "+" : ""}${v.toFixed(digits)}%`; }
function judge(score = 0) { if (score >= 95) return "👑 大本命"; if (score >= 85) return "🔥 激熱"; if (score >= 70) return "🟢 強い"; if (score >= 50) return "🟡 静観"; return "🔴 見送り"; }
function judgeColor(score = 0) { if (score >= 95) return "bg-yellow-100 text-yellow-700 border-yellow-200"; if (score >= 85) return "bg-red-100 text-red-600 border-red-200"; if (score >= 70) return "bg-green-100 text-green-700 border-green-200"; if (score >= 50) return "bg-yellow-100 text-yellow-700 border-yellow-200"; return "bg-slate-100 text-slate-600 border-slate-200"; }
function rankBg(i: number) { return i === 0 ? "bg-yellow-400" : i === 1 ? "bg-slate-400" : i === 2 ? "bg-orange-500" : "bg-blue-600"; }
function rankLabel(i: number) { return i === 0 ? "🥇 1位" : i === 1 ? "🥈 2位" : i === 2 ? "🥉 3位" : `${i + 1}位`; }
function stars(score = 0, winRate = 0, judged = 0) { const base = score * .45 + Math.min(100, winRate) * .35 + Math.min(100, judged * 5) * .2; const n = Math.max(1, Math.min(5, Math.round(base / 20))); return `${"★".repeat(n)}${"☆".repeat(5 - n)}`; }

function isPattern(v: unknown): v is DetectedChartPattern {
  if (!v || typeof v !== "object") return false;
  const p = v as Partial<DetectedChartPattern>;
  return typeof p.id === "string" && typeof p.name === "string" && (p.direction === "BUY" || p.direction === "SELL" || p.direction === "NEUTRAL") && typeof p.confidence === "number" && typeof p.score === "number" && Array.isArray(p.reasons);
}

function normalizeStock(raw: Record<string, unknown>): Stock {
  const score = num(raw.score ?? raw.aiPower ?? raw.power);
  const price = num(raw.price ?? raw.currentPrice ?? raw.current_price);
  const takeProfit = num(raw.takeProfit ?? raw.targetPrice ?? raw.take_profit);
  const winRate = opt(raw.winRate ?? raw.winningRate ?? raw.win_rate);
  const judgedCount = opt(raw.judgedCount ?? raw.judgementCount ?? raw.totalJudged ?? raw.judged_count);
  const expectedProfitRate = num(raw.expectedProfitRate ?? raw.expectedReturn ?? raw.expected_profit_rate) || (price > 0 && takeProfit > 0 ? ((takeProfit - price) / price) * 100 : 0);
  const expectedProfitAmount = num(raw.expectedProfitAmount ?? raw.expectedProfit ?? raw.expected_profit_amount) || (price > 0 && takeProfit > 0 ? (takeProfit - price) * 100 : 0);
  const reliabilityScore = num(raw.reliabilityScore ?? raw.confidenceScore ?? raw.reliability_score) || Math.round(score * .45 + Math.min(100, winRate ?? 0) * .35 + Math.min(100, (judgedCount ?? 0) * 5) * .2);
  return {
    code: String(raw.code ?? raw.stockCode ?? raw.symbol ?? ""), name: String(raw.name ?? raw.stockName ?? raw.companyName ?? "銘柄名未取得"),
    score, rawAiPower: opt(raw.rawAiPower ?? raw.raw_ai_power), price,
    changePercent: num(raw.changePercent ?? raw.change_rate ?? raw.changeRate), volumeRatio: num(raw.volumeRatio ?? raw.volume_ratio),
    reason: String(raw.reason ?? raw.comment ?? raw.aiReason ?? ""), winRate, judgedCount,
    wins: opt(raw.wins ?? raw.winCount ?? raw.win_count), losses: opt(raw.losses ?? raw.lossCount ?? raw.loss_count), holds: opt(raw.holds ?? raw.holdCount ?? raw.hold_count),
    totalProfitYen: opt(raw.totalProfitYen ?? raw.total_profit_yen), expectedProfitRate, expectedProfitAmount, reliabilityScore,
    detectedPatterns: Array.isArray(raw.detectedPatterns) ? raw.detectedPatterns.filter(isPattern) : undefined,
  };
}

const patternStyles = {
  BUY: { label: "BUY", box: "border-emerald-200 bg-emerald-50", badge: "bg-emerald-600 text-white", text: "text-emerald-700" },
  SELL: { label: "SELL", box: "border-red-200 bg-red-50", badge: "bg-red-600 text-white", text: "text-red-700" },
  NEUTRAL: { label: "NEUTRAL", box: "border-blue-200 bg-blue-50", badge: "bg-blue-600 text-white", text: "text-blue-700" },
} as const;

function Pattern({ patterns }: { patterns?: DetectedChartPattern[] }) {
  const pattern = [...(patterns ?? [])].sort((a, b) => b.confidence - a.confidence || Math.abs(b.score) - Math.abs(a.score))[0];
  if (!pattern) return null;
  const s = patternStyles[pattern.direction];
  const href = hasChartPatternCatalogItem(pattern.id) ? `/learning/patterns/${encodeURIComponent(pattern.id)}` : "/learning/patterns";
  return <section className={`mt-3 rounded-2xl border p-3 ${s.box}`}>
    <p className="text-[10px] font-black tracking-[.14em] text-slate-500">AI検出パターン</p>
    <div className="mt-2 flex items-center gap-2"><p className="min-w-0 flex-1 text-sm font-black">{pattern.name}</p><span className={`rounded-full px-2.5 py-1 text-[10px] font-black ${s.badge}`}>{s.label}</span></div>
    <div className="mt-2 flex items-center justify-between gap-2"><p className={`text-xs font-black ${s.text}`}>信頼度 {Math.round(Math.min(100, Math.max(0, pattern.confidence)))}%</p><Link href={href} className="rounded-xl border border-white/80 bg-white px-3 py-2 text-xs font-black text-blue-700 shadow-sm">図鑑で見る →</Link></div>
  </section>;
}

export default function RankingPage() {
  const [stocks, setStocks] = useState<Stock[]>([]); const [loading, setLoading] = useState(true); const [error, setError] = useState("");
  const [keyword, setKeyword] = useState(""); const [sortMode, setSortMode] = useState<SortMode>("score"); const [budgetMode, setBudgetMode] = useState<BudgetMode>("all");
  async function fetchRanking() {
    setLoading(true); setError("");
    try { const c = new AbortController(); const t = window.setTimeout(() => c.abort(), 30000); try {
      const res = await fetch("/api/scan?limit=100&top=100", { cache: "no-store", signal: c.signal }); if (!res.ok) throw new Error(String(res.status));
      const json = await res.json(); const list = Array.isArray(json) ? json : Array.isArray(json?.stocks) ? json.stocks : Array.isArray(json?.data) ? json.data : [];
      setStocks(list.map((x: Record<string, unknown>) => normalizeStock(x)));
    } finally { window.clearTimeout(t); } } catch (e) { console.error(e); setStocks([]); setError("ランキングデータを取得できませんでした。"); } finally { setLoading(false); }
  }
  useEffect(() => { void fetchRanking(); }, []);
  const filteredStocks = useMemo(() => {
    const budget = budgetMode === "all" ? Infinity : Number(budgetMode);
    return stocks.filter(s => `${s.code} ${s.name}`.toLowerCase().includes(keyword.toLowerCase()) && s.price * 100 <= budget).sort((a,b) => {
      if (sortMode === "winRate") return (b.winRate ?? 0) - (a.winRate ?? 0) || (b.judgedCount ?? 0) - (a.judgedCount ?? 0);
      if (sortMode === "expectedProfit") return (b.expectedProfitAmount ?? 0) - (a.expectedProfitAmount ?? 0);
      if (sortMode === "capital") return a.price - b.price; if (sortMode === "change") return (b.changePercent ?? 0) - (a.changePercent ?? 0);
      if (sortMode === "reliability") return (b.reliabilityScore ?? 0) - (a.reliabilityScore ?? 0);
      return (b.rawAiPower ?? b.score) - (a.rawAiPower ?? a.score) || (b.changePercent ?? 0) - (a.changePercent ?? 0) || (b.volumeRatio ?? 0) - (a.volumeRatio ?? 0) || a.code.localeCompare(b.code, "ja", { numeric: true });
    }).slice(0,100);
  }, [stocks, keyword, sortMode, budgetMode]);
  const top = filteredStocks[0];

  return <main className="min-h-screen bg-[#f7f9fc] pb-24 text-slate-900"><div className="mx-auto max-w-md px-4 pt-4">
    <header className="mb-4 flex items-center justify-between"><Link href="/dashboard" className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-2xl shadow">‹</Link><div className="text-center"><div className="text-3xl font-black">SIGNAL<span className="text-blue-600">X</span></div><div className="text-xs font-black tracking-[.22em] text-slate-500">AI RANKING FINAL</div></div><button type="button" onClick={() => void fetchRanking()} disabled={loading} className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-lg shadow">↻</button></header>
    <section className="mb-4 rounded-[24px] border border-purple-200 bg-gradient-to-br from-white to-purple-50 p-4 shadow-sm"><p className="text-sm font-black text-purple-600">🏆 AIランキング TOP100</p><div className="mt-2 flex items-end justify-between"><div><h1 className="text-5xl font-black">{loading ? "-" : filteredStocks.length}</h1><p className="text-sm font-bold text-slate-500">表示中の銘柄</p></div>{top && <div className="text-right"><p className="text-xs font-black text-slate-500">現在1位</p><p className="text-xl font-black text-purple-600">{top.code}</p><p className="text-xs font-bold text-slate-500">AI POWER {Math.round(top.score)}</p></div>}</div></section>
    <section className="mb-4 rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm"><input value={keyword} onChange={e=>setKeyword(e.target.value)} placeholder="銘柄コード・名前で検索" className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 font-bold outline-none"/><p className="mb-2 mt-4 text-xs font-black tracking-[.12em] text-slate-500">並び替え</p><div className="grid grid-cols-3 gap-2">{SORT_OPTIONS.map(o=><button key={o.value} onClick={()=>setSortMode(o.value)} className={`rounded-2xl py-3 text-xs font-black ${sortMode===o.value?"bg-purple-600 text-white":"border border-slate-200 bg-slate-50 text-slate-500"}`}>{o.label}</button>)}</div><p className="mb-2 mt-4 text-xs font-black tracking-[.12em] text-slate-500">100株の予算</p><div className="flex gap-2 overflow-x-auto pb-1">{BUDGET_OPTIONS.map(o=><button key={o.value} onClick={()=>setBudgetMode(o.value)} className={`shrink-0 rounded-full px-4 py-2 text-xs font-black ${budgetMode===o.value?"bg-blue-600 text-white":"border border-slate-200 bg-slate-50 text-slate-500"}`}>{o.label}</button>)}</div></section>
    {loading && <CardText text="AIランキングを読み込み中..."/>}{!loading && error && <CardText text={error}/>} {!loading && !error && !filteredStocks.length && <CardText text="該当銘柄なし"/>}
    {top && <article className="mb-4 rounded-[24px] border border-yellow-200 bg-white p-4 shadow-sm"><p className="text-sm font-black text-yellow-600">👑 本日の最有力</p><div className="mt-3 flex items-start justify-between gap-3"><div><p className="text-4xl font-black">{top.code}</p><Link href={`/analysis/${top.code}`} aria-label={`${top.name}のAI解析を見る`} className="block text-2xl font-black text-yellow-600 underline-offset-4 active:opacity-60">{top.name}</Link></div><Power score={top.score}/></div><Pattern patterns={top.detectedPatterns}/><Stats stock={top} top/><Buttons stock={top}/></article>}
    <section className="space-y-3">{filteredStocks.map((stock,index)=><article key={`${stock.code}-${index}`} className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
      {stock.score>=95?<div className="mb-3 rounded-2xl bg-yellow-50 px-3 py-2 text-xs font-black text-yellow-700">👑 TODAY BEST</div>:stock.score>=85?<div className="mb-3 rounded-2xl bg-red-50 px-3 py-2 text-xs font-black text-red-600">🔥 HOT</div>:null}
      <div className="flex items-start justify-between gap-3"><div className="flex min-w-0 items-start gap-3"><div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl font-black text-white ${rankBg(index)}`}>{index+1}</div><div className="min-w-0"><p className="text-xs font-black text-purple-600">{rankLabel(index)}</p><div className="mt-1 flex items-center gap-2"><h2 className="text-2xl font-black">{stock.code}</h2><span className={`rounded-xl border px-2 py-1 text-xs font-black ${judgeColor(stock.score)}`}>{judge(stock.score)}</span></div><Link href={`/analysis/${stock.code}`} aria-label={`${stock.name}のAI解析を見る`} className="block truncate text-lg font-black underline-offset-4 active:opacity-60">{stock.name}</Link><p className="mt-1 truncate text-xs font-bold text-slate-500">{stock.reason||"AI理由なし"}</p></div></div><div className="shrink-0 text-right"><Power score={stock.score}/><p className="mt-1 text-xs font-black text-amber-500">{stars(stock.score,stock.winRate,stock.judgedCount)}</p></div></div>
      <Pattern patterns={stock.detectedPatterns}/><Stats stock={stock}/><Buttons stock={stock}/>
    </article>)}</section>
  </div><BottomNav/></main>;
}

function Power({score}:{score:number}) { return <div className="text-right"><p className="text-xs font-black text-slate-500">AI POWER</p><p className="text-3xl font-black text-blue-600">{Math.round(score)}</p></div>; }
function Mini({label,value}:{label:string;value:string}) { return <div className="rounded-2xl border border-slate-100 bg-slate-50 p-3 text-center"><p className="text-[10px] font-black text-slate-500">{label}</p><p className="mt-1 whitespace-pre-line break-words text-base font-black leading-6">{value}</p></div>; }
function Stats({stock,top=false}:{stock:Stock;top?:boolean}) { return <><div className={`mt-4 grid ${top?"grid-cols-2":"grid-cols-3"} gap-2`}><Mini label="30日勝率" value={percent(stock.winRate)}/><Mini label="累計損益" value={signedYen(stock.totalProfitYen)}/><Mini label="判定済み" value={stock.judgedCount===undefined?"実績なし":`${stock.judgedCount}件`}/><Mini label="30日実績" value={stock.wins===undefined||stock.losses===undefined||stock.holds===undefined?"実績なし":`${stock.wins}勝${stock.losses}敗\nHOLD${stock.holds}件`}/><Mini label={top?"必要資金":"100株"} value={yen(stock.price*100)}/><Mini label="期待利益" value={stock.expectedProfitAmount?yen(stock.expectedProfitAmount):percent(stock.expectedProfitRate)}/>{top&&<Mini label="判定" value={judge(stock.score)}/>}</div>{!top&&<div className="mt-2 grid grid-cols-3 gap-2"><Mini label="現在値" value={yen(stock.price)}/><Mini label="上昇率" value={percent(stock.changePercent)}/><Mini label="信頼度" value={`${Math.round(stock.reliabilityScore??0)}`}/></div>}</>; }
function Buttons({stock}:{stock:Stock}) { return <div className="mt-3 grid grid-cols-2 gap-2"><Link href={`/analysis/${stock.code}`} className="rounded-2xl bg-blue-600 py-3 text-center text-sm font-black text-white">AI解析</Link><Link href={`/analysis/${stock.code}/performance`} className="rounded-2xl border border-blue-200 bg-blue-50 py-3 text-center text-sm font-black text-blue-700">AI実績</Link></div>; }
function CardText({text}:{text:string}) { return <section className="mb-4 rounded-[24px] border border-slate-200 bg-white p-5 text-center font-bold text-slate-500 shadow-sm">{text}</section>; }
