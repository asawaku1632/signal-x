"use client";

import Link from "next/link";
import AiScoreTierBadge from "@/app/components/stock/AiScoreTierBadge";
import { getAiScoreTier } from "@/app/lib/aiScoreTier";
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
type BudgetMode = "all" | "10000" | "50000" | "100000" | "300000" | "500000" | "1000000";

const BUDGET_OPTIONS: { value: BudgetMode; label: string }[] = [
  { value: "all", label: "制限なし" }, { value: "10000", label: "1万円" },
  { value: "50000", label: "5万円" }, { value: "100000", label: "10万円" },
  { value: "300000", label: "30万円" }, { value: "500000", label: "50万円" },
  { value: "1000000", label: "100万円" },
];
const QUICK_BUDGET_OPTIONS: { value: BudgetMode; label: string }[] = [
  { value: "all", label: "全件" }, { value: "100000", label: "10万" },
  { value: "300000", label: "30万" }, { value: "500000", label: "50万" },
  { value: "1000000", label: "100万" },
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
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [keyword, setKeyword] = useState("");
  const [sortMode, setSortMode] = useState<SortMode>("score");
  const [budgetMode, setBudgetMode] = useState<BudgetMode>("all");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [visibleCount, setVisibleCount] = useState(20);
  const [snapshot, setSnapshot] = useState<{ date: string | null; updatedAt: string | null }>({ date: null, updatedAt: null });

  async function fetchRanking() {
    setLoading(true);
    setError("");
    try {
      const controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), 30000);
      try {
        const response = await fetch("/api/scan?limit=100&top=100", {
          cache: "no-store", signal: controller.signal,
        });
        if (!response.ok) throw new Error(String(response.status));
        const data = await response.json();
        const list = Array.isArray(data) ? data
          : Array.isArray(data?.stocks) ? data.stocks
          : Array.isArray(data?.data) ? data.data : [];
        setStocks(list.map((raw: Record<string, unknown>) => normalizeStock(raw)));
        setSnapshot({
          date: typeof data?.latestQuoteDateJst === "string" ? data.latestQuoteDateJst : null,
          updatedAt: typeof data?.updatedAt === "string" ? data.updatedAt : null,
        });
      } finally {
        window.clearTimeout(timeout);
      }
    } catch (cause) {
      console.error("ranking fetch error:", cause);
      setStocks([]);
      setError("ランキングデータを取得できませんでした。");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void fetchRanking();
  }, []);

  const filteredStocks = useMemo(() => {
    const budget = budgetMode === "all" ? Infinity : Number(budgetMode);
    return stocks
      .filter((stock) =>
        (stock.code + " " + stock.name).toLowerCase().includes(keyword.toLowerCase()) &&
        (budgetMode === "all" || (stock.price > 0 && Number.isFinite(stock.price) && stock.price * 100 <= budget)),
      )
      .sort((a, b) => {
        if (sortMode === "winRate") return (b.winRate ?? -1) - (a.winRate ?? -1) || (b.judgedCount ?? 0) - (a.judgedCount ?? 0);
        if (sortMode === "expectedProfit") return (b.expectedProfitAmount ?? 0) - (a.expectedProfitAmount ?? 0);
        if (sortMode === "capital") return a.price - b.price;
        if (sortMode === "change") return (b.changePercent ?? 0) - (a.changePercent ?? 0);
        if (sortMode === "reliability") return (b.reliabilityScore ?? 0) - (a.reliabilityScore ?? 0);
        return (b.rawAiPower ?? b.score) - (a.rawAiPower ?? a.score) ||
          (b.changePercent ?? 0) - (a.changePercent ?? 0) ||
          (b.volumeRatio ?? 0) - (a.volumeRatio ?? 0) ||
          a.code.localeCompare(b.code, "ja", { numeric: true });
      })
      .slice(0, 100);
  }, [stocks, keyword, sortMode, budgetMode]);

  const visibleStocks = filteredStocks.slice(0, visibleCount);
  const activeBudget = BUDGET_OPTIONS.find((option) => option.value === budgetMode)?.label ?? "制限なし";
  const activeSort = SORT_OPTIONS.find((option) => option.value === sortMode)?.label ?? "AI POWER";
  const selectClass = "min-h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-800";

  return (
    <main className="min-h-screen bg-slate-50 pb-28 text-slate-900">
      <div className="mx-auto w-full max-w-2xl px-3 pb-7 pt-3 sm:px-5">
        <header className="flex items-center justify-between gap-2">
          <Link href="/dashboard" aria-label="SIGNALXホーム" className="flex min-h-10 items-center gap-2">
            <span className="text-3xl font-black italic text-blue-600">X</span>
            <span className="text-base font-black">SIGNAL<span className="text-blue-600">X</span></span>
          </Link>
          <button type="button" onClick={() => void fetchRanking()} disabled={loading}
            className="min-h-10 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold shadow-sm disabled:opacity-50">
            {loading ? "更新中…" : "更新 ↻"}
          </button>
        </header>

        <section className="mt-3" aria-label="AIランキング検索と条件">
          <div className="flex items-end justify-between gap-3">
            <h1 className="text-xl font-black sm:text-2xl">🏆 AIランキング</h1>
            <span className="text-xs font-bold text-slate-500">{loading ? "取得中" : filteredStocks.length + "銘柄"}</span>
          </div>
          <p className="mt-1 text-xs text-slate-500">保存AI評価のランキング・株価基準日 {snapshot.date ?? "未確認"}</p>
          <input aria-label="銘柄コード・名前で検索" value={keyword}
            onChange={(event) => { setKeyword(event.target.value); setVisibleCount(20); }}
            placeholder="🔍 銘柄コード・名前で検索"
            className="mt-3 min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold outline-none focus:border-blue-400" />

          <div className="mt-2 grid grid-cols-5 gap-1.5" aria-label="100株の予算">
            {QUICK_BUDGET_OPTIONS.map((option) => (
              <button type="button" key={option.value} aria-pressed={budgetMode === option.value}
                onClick={() => { setBudgetMode(option.value); setVisibleCount(20); }}
                className={"min-h-10 rounded-xl border px-0.5 text-xs font-black " +
                  (budgetMode === option.value
                    ? "border-blue-600 bg-blue-600 text-white"
                    : "border-slate-200 bg-white text-slate-700")}>
                {option.label}
              </button>
            ))}
          </div>
          <div className="mt-1 flex items-center justify-between gap-2">
            <p className="min-w-0 truncate text-xs font-semibold text-slate-500">{activeBudget} · {activeSort}順</p>
            <button type="button" aria-expanded={filtersOpen} onClick={() => setFiltersOpen((value) => !value)}
              className="min-h-9 shrink-0 px-2 text-sm font-bold text-blue-700">
              {filtersOpen ? "詳細条件を閉じる ▲" : "並び替え・条件 ▼"}
            </button>
          </div>
          {filtersOpen && (
            <div className="mt-2 grid gap-3 rounded-xl border border-slate-200 bg-white p-3 sm:grid-cols-2">
              <label className="grid gap-1 text-xs font-bold">
                並び順
                <select value={sortMode} onChange={(event) => { setSortMode(event.target.value as SortMode); setVisibleCount(20); }}
                  className={selectClass}>
                  {SORT_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              </label>
              <label className="grid gap-1 text-xs font-bold">
                100株の予算
                <select value={budgetMode} onChange={(event) => { setBudgetMode(event.target.value as BudgetMode); setVisibleCount(20); }}
                  className={selectClass}>
                  {BUDGET_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              </label>
              <p className="text-xs leading-5 text-slate-500 sm:col-span-2">
                勝率や期待利益は保存データの参考値です。対象期間や勝敗確定件数を個別に確認してください。
              </p>
            </div>
          )}
        </section>

        {loading && <CardText text="保存ランキングを読み込み中…" />}
        {!loading && error && <CardText text={error} />}
        {!loading && !error && filteredStocks.length === 0 && <CardText text="条件に合う銘柄はありません" />}

        {!loading && !error && visibleStocks.length > 0 && (
          <section aria-label="AIランキングの銘柄一覧" className="mt-3 space-y-2">
            {visibleStocks.map((stock, index) => (
              <CompactRankingCard key={stock.code + "-" + index} stock={stock} rank={index + 1} />
            ))}
            {filteredStocks.length > visibleCount && (
              <button type="button" onClick={() => setVisibleCount((value) => Math.min(value + 20, 100))}
                className="min-h-11 w-full rounded-xl border border-blue-200 bg-white text-sm font-black text-blue-700">
                さらに20銘柄を見る（表示 {visibleStocks.length} / {filteredStocks.length}）
              </button>
            )}
          </section>
        )}

        <details className="mt-4 rounded-xl border border-slate-200 bg-white p-3 text-xs">
          <summary className="cursor-pointer font-bold text-slate-700">データ日時・ランキングの注意点</summary>
          <div className="mt-2 space-y-1 leading-6 text-slate-600">
            <p>保存スキャン日時：{snapshot.updatedAt ? new Date(snapshot.updatedAt).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" }) : "未確認"}</p>
            <p>取得した{stocks.length}銘柄から選んだ表示順位です。東証全銘柄の完全ランキングではありません。</p>
            <p>「本命」などは保存時AIスコアの表示帯であり、実測勝率や買い時を示すものではありません。</p>
            <p>証券会社のリアルタイム株価とは異なるため、購入前に当日の株価・出来高・チャートを確認してください。</p>
          </div>
        </details>
      </div>
      <BottomNav />
    </main>
  );
}

function CompactRankingCard({ stock, rank }: { stock: Stock; rank: number }) {
  const priceKnown = Number.isFinite(stock.price) && stock.price > 0;
  const changeKnown = typeof stock.changePercent === "number" && Number.isFinite(stock.changePercent);
  const change = stock.changePercent ?? 0;
  const changeTone = !changeKnown ? "text-slate-500" :
    change > 0 ? "text-emerald-700" : change < 0 ? "text-rose-600" : "text-slate-700";
  const href = "/analysis/" + encodeURIComponent(stock.code);

  return (
    <article data-testid="compact-ranking-card"
      className={"rounded-2xl border bg-white p-3 shadow-sm " +
        (rank === 1 ? "border-amber-300" : "border-slate-200")}>
      <Link href={href} aria-label={rank + "位 " + stock.code + " " + stock.name + " のAI解析"}
        className="flex min-w-0 items-center gap-2.5 rounded-lg">
        <span className={"grid h-10 w-10 shrink-0 place-items-center rounded-xl text-sm font-black " +
          (rank === 1 ? "bg-amber-100 text-amber-800" : rank <= 3
            ? "bg-blue-50 text-blue-700" : "bg-slate-100 text-slate-700")}>
          {rank + "位"}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold text-slate-500">{stock.code}</p>
          <div className="flex min-w-0 items-center gap-1.5">
            <h2 className="min-w-0 truncate text-base font-black leading-6">{stock.name}</h2>
            <AiScoreTierBadge score={stock.score} />
          </div>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-[11px] font-bold text-slate-500">AI評価</p>
          <p className="text-2xl font-black leading-7 tabular-nums text-blue-600">
            {Number.isFinite(stock.score) ? (Math.round(stock.score * 10) / 10).toLocaleString("ja-JP") : "—"}
          </p>
        </div>
      </Link>

      <dl className="mt-2 grid grid-cols-3 rounded-xl bg-slate-50 px-1 py-2">
        <div className="min-w-0 px-1 text-center">
          <dt className="text-[11px] font-semibold text-slate-500">参考株価</dt>
          <dd className="mt-0.5 truncate text-[13px] font-black tabular-nums">{priceKnown ? yen(stock.price) : "—"}</dd>
        </div>
        <div className="min-w-0 border-x border-slate-200 px-1 text-center">
          <dt className="text-[11px] font-semibold text-slate-500">100株必要額</dt>
          <dd className="mt-0.5 truncate text-[13px] font-black tabular-nums">{priceKnown ? yen(stock.price * 100) : "—"}</dd>
        </div>
        <div className="min-w-0 px-1 text-center">
          <dt className="text-[11px] font-semibold text-slate-500">変化率</dt>
          <dd className={"mt-0.5 truncate text-[13px] font-black tabular-nums " + changeTone}>
            {changeKnown ? percent(change, 2) : "—"}
          </dd>
        </div>
      </dl>

      <div className="mt-2 flex items-center justify-between gap-2">
        <p className="min-w-0 truncate text-xs text-slate-600">{stock.reason || "判定理由は個別解析で確認"}</p>
        <Link href={href} className="shrink-0 text-xs font-bold text-blue-700">詳しく ›</Link>
      </div>

      <details className="mt-2 border-t border-slate-100 pt-1 text-xs">
        <summary className="min-h-9 cursor-pointer py-2 font-bold text-slate-600">過去実績・AIパターンを表示 ▼</summary>
        <div className="mt-2 grid grid-cols-2 gap-2 rounded-xl bg-slate-50 p-2">
          <Mini label="30日参考勝率" value={percent(stock.winRate)} />
          <Mini label="判定済み件数" value={stock.judgedCount === undefined ? "不明" : stock.judgedCount + "件"} />
          <Mini label="勝敗確定" value={stock.wins === undefined || stock.losses === undefined ? "不明" : stock.wins + "勝 " + stock.losses + "敗"} />
          <Mini label="HOLD" value={stock.holds === undefined ? "不明" : stock.holds + "件"} />
          <Mini label="累計損益（参考）" value={signedYen(stock.totalProfitYen)} />
          <Mini label="期待利益（試算）" value={stock.expectedProfitAmount ? yen(stock.expectedProfitAmount) : percent(stock.expectedProfitRate)} />
          <Mini label="参考信頼度" value={stock.reliabilityScore === undefined ? "不明" : String(Math.round(stock.reliabilityScore))} />
          <Mini label="スコア帯" value={getAiScoreTier(stock.score).label} />
        </div>
        <p className="mt-2 text-[11px] leading-5 text-slate-500">勝率はHOLDを除いた確定勝敗など、集計対象を確認してください。表示された数字は将来利益を保証しません。</p>
        <Pattern patterns={stock.detectedPatterns} />
        <div className="mt-3 grid grid-cols-2 gap-2">
          <Link href={href} className="flex min-h-10 items-center justify-center rounded-xl bg-blue-600 text-sm font-bold text-white">AI解析</Link>
          <Link href={href + "/performance"} className="flex min-h-10 items-center justify-center rounded-xl border border-blue-200 bg-blue-50 text-sm font-bold text-blue-700">AI実績</Link>
        </div>
      </details>
    </article>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return <div className="min-w-0 rounded-lg border border-slate-100 bg-white px-2 py-2">
    <p className="text-[10px] font-semibold text-slate-500">{label}</p>
    <p className="mt-0.5 break-words text-xs font-black">{value}</p>
  </div>;
}

function CardText({ text }: { text: string }) {
  return <section className="mt-3 rounded-xl border border-slate-200 bg-white p-5 text-center text-sm font-bold text-slate-600">{text}</section>;
}
