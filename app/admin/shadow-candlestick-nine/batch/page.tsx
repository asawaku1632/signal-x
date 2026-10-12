import Link from "next/link";
import { notFound } from "next/navigation";
import BottomNav from "@/app/components/BottomNav";
import { getLearningOwnerSession } from "@/app/lib/learningOwner";
import type { ShadowCandle } from "@/app/lib/research/shadowCandlestickNine";
import {
  parseShadowBatchCodes,
  studyShadowCandleBatch,
  type BatchHorizonStats,
  type BatchStockData,
} from "@/app/lib/research/shadowCandlestickBatch";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const PRESETS: Record<string, { label: string; codes: string }> = {
  A: { label: "サンプルA（5銘柄）", codes: "3182,3387,6855,7203,9984" },
  B: { label: "サンプルB（5銘柄）", codes: "1605,2760,3994,5805,8058" },
};
const MAX_HISTORY = 135;

type Props = { searchParams: Promise<{ codes?: string; preset?: string }> };
type LoadedStock = {
  code: string;
  candles: ShadowCandle[];
  error: string | null;
};

function dateJst(seconds: number) {
  return new Date(seconds * 1000).toLocaleDateString("sv-SE", { timeZone: "Asia/Tokyo" });
}
function jstToday() {
  return new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Tokyo" });
}
function positive(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) return null;
  return value;
}

// Per-click, owner-only, bounded and explicitly selected codes.
// No periodic work, writing, caching, background collection or bulk universe access.
async function fetchCompletedDailyBars(code: string): Promise<LoadedStock> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5_500);
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(code + ".T")}?range=6mo&interval=1d`;
    const response = await fetch(url, {
      cache: "no-store",
      headers: { "User-Agent": "Mozilla/5.0" },
      signal: controller.signal,
    });
    if (!response.ok) return { code, candles: [], error: "株価取得に失敗（応答エラー）" };
    const value: unknown = await response.json();
    const chart = (value as {
      chart?: {
        error?: unknown;
        result?: Array<{
          timestamp?: unknown;
          indicators?: { quote?: Array<{
            open?: unknown; high?: unknown; low?: unknown; close?: unknown; volume?: unknown;
          }> };
        }>;
      };
    })?.chart;
    if (!chart || chart.error || !Array.isArray(chart.result)) throw new Error("invalid market data");
    const first = chart.result[0];
    const timeValues = first?.timestamp;
    const quote = first?.indicators?.quote?.[0];
    if (!Array.isArray(timeValues) || !quote ||
      !Array.isArray(quote.open) || !Array.isArray(quote.high) ||
      !Array.isArray(quote.low) || !Array.isArray(quote.close)) throw new Error("missing daily OHLC");

    const cutoff = jstToday();
    const candles: ShadowCandle[] = [];
    for (let i = 0; i < timeValues.length; i++) {
      const time = positive(timeValues[i]);
      const open = positive(quote.open[i]);
      const high = positive(quote.high[i]);
      const low = positive(quote.low[i]);
      const close = positive(quote.close[i]);
      if (!time || !open || !high || !low || !close ||
        high < Math.max(open, low, close) ||
        low > Math.min(open, high, close) ||
        dateJst(time) >= cutoff) continue; // Excludes incomplete/current-day OHLC.
      if (candles.length && time <= candles[candles.length - 1].time) continue;
      candles.push({
        time, open, high, low, close,
        volume: Array.isArray(quote.volume) ? positive(quote.volume[i]) ?? undefined : undefined,
      });
    }
    if (candles.length < 20) return { code, candles: [], error: "確定済み日足が20本未満" };
    return { code, candles: candles.slice(-MAX_HISTORY), error: null };
  } catch (error) {
    console.warn("shadow batch daily-data fetch failed", code, error instanceof Error ? error.message : "unknown");
    return { code, candles: [], error: "参考日足が取得できませんでした" };
  } finally {
    clearTimeout(timer);
  }
}

async function fetchCohort(codes: string[]): Promise<LoadedStock[]> {
  const results: LoadedStock[] = new Array(codes.length);
  let nextIndex = 0;
  // At most 3 simultaneous HTTP calls, at most 5 in total.
  const worker = async () => {
    while (nextIndex < codes.length) {
      const index = nextIndex++;
      results[index] = await fetchCompletedDailyBars(codes[index]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(3, codes.length) }, () => worker()));
  return results;
}

function signed(value: number | null): string {
  return value === null ? "—" : `${value > 0 ? "+" : ""}${value.toFixed(2)}%`;
}
function pct(value: number | null): string {
  return value === null ? "—" : `${value.toFixed(1)}%`;
}

function Horizon({ value }: { value: BatchHorizonStats }) {
  return (
    <div className="rounded-xl bg-slate-50 p-2 text-center">
      <p className="text-[11px] font-bold text-slate-600">{value.horizon}営業日後</p>
      <p className="mt-1 text-lg font-black">{pct(value.winPercent)}</p>
      <p className="text-[10px] text-slate-500">方向一致 {value.wins}/{value.completed}件</p>
      <p className="mt-1 text-xs font-black text-blue-700">{signed(value.averageDirectionalPercent)}</p>
      <p className="text-[10px] text-slate-500">平均方向騰落率</p>
      <p className="mt-1 text-[11px] text-slate-600">
        最悪 {signed(value.worstDirectionalPercent)}
      </p>
    </div>
  );
}

export default async function ShadowCandlestickBatchPage({ searchParams }: Props) {
  const { isOwner } = await getLearningOwnerSession();
  if (!isOwner) notFound();

  const args = await searchParams;
  const preset = typeof args.preset === "string" && Object.hasOwn(PRESETS, args.preset)
    ? args.preset : null;
  const input = preset ? PRESETS[preset].codes : (typeof args.codes === "string" ? args.codes.slice(0, 180) : "");
  const attempted = preset !== null || (typeof args.codes === "string" && args.codes.trim() !== "");
  const parsed = parseShadowBatchCodes(input);
  // No data request unless a submitted input or known preset is supplied.
  const loaded = attempted && !parsed.error && parsed.codes.length
    ? await fetchCohort(parsed.codes)
    : [];
  const successes: BatchStockData[] = loaded.filter(x => !x.error).map(x => ({ code: x.code, candles: x.candles }));
  const report = successes.length ? studyShadowCandleBatch(successes) : null;
  const excluded = loaded.filter(x => x.error);
  const ordered = report ? [...report.rows].sort((a, b) =>
    b.horizons[2].completed - a.horizons[2].completed || a.id.localeCompare(b.id)) : [];
  return (
    <main className="min-h-screen bg-slate-50 pb-28 text-slate-900">
      <div className="mx-auto max-w-4xl px-3 pt-5 sm:px-6">
        <Link href="/admin/shadow-candlestick-nine" prefetch={false}
          className="text-sm font-black text-blue-700">← 1銘柄研究へ戻る</Link>
        <h1 className="mt-4 text-2xl font-black">🕯️ ローソク足9種類・複数銘柄比較</h1>
        <section className="mt-4 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm leading-6">
          <p className="font-black">🔒 本人専用 / SHADOW ONLY / 最大5銘柄 / 読み取りのみ</p>
          <p className="mt-2">調べたい銘柄を指定したときだけ、最大5銘柄の過去6か月の参考日足を取得します。
            既存のAI POWER・LINE通知・売買判定・学習DBには反映しません。</p>
          <p>1回の分析ごとに最大5回のYahoo通信が発生します。新規有料契約は不要ですが、
            Vercel関数と通信量が増える可能性はあります。</p>
        </section>
        <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
          <form action="/admin/shadow-candlestick-nine/batch" method="get">
            <label className="block text-sm font-black">
              銘柄コード（2〜5銘柄がおすすめ・カンマ区切り）
              <input name="codes" type="text" defaultValue={input}
                maxLength={180} autoComplete="off" placeholder="3182,3387,6855,7203,9984"
                className="mt-2 h-12 w-full rounded-xl border border-slate-300 px-3 text-base" />
            </label>
            <div className="mt-3 grid grid-cols-3 gap-2">
              <button type="submit" className="min-h-12 rounded-xl bg-blue-700 px-2 text-xs font-black text-white sm:text-sm">
                まとめて検証
              </button>
              {Object.entries(PRESETS).map(([key, value]) => (
                <button type="submit" key={key} name="preset" value={key}
                  className="min-h-12 rounded-xl border border-blue-300 bg-blue-50 px-1 text-xs font-black text-blue-800 sm:text-sm">
                  {value.label}
                </button>
              ))}
            </div>
          </form>
          <p className="mt-3 text-xs leading-5 text-slate-600">
            最初は何も取得しません。比較は事前に選んだ少数銘柄の試行で、母集団を無作為抽出したものではありません。
            入力ミスや通信失敗の銘柄は結果から除外します。
          </p>
        </section>
        {parsed.error && <p role="alert" className="mt-4 rounded-xl bg-rose-50 p-4 text-sm font-bold text-rose-800">{parsed.error}</p>}
        {attempted && !parsed.error && loaded.length > 0 && (
          <>
            <section className="mt-4 rounded-2xl border border-blue-200 bg-white p-4">
              <h2 className="text-lg font-black">今回の検証概要</h2>
              <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                <div className="rounded-xl bg-blue-50 p-2">
                  <p className="text-xs text-slate-600">取得成功</p>
                  <p className="text-xl font-black">{successes.length}/{parsed.codes.length}銘柄</p>
                </div>
                <div className="rounded-xl bg-blue-50 p-2">
                  <p className="text-xs text-slate-600">検出延べ回数</p>
                  <p className="text-xl font-black">{report?.totalDetections ?? 0}件</p>
                </div>
                <div className="rounded-xl bg-blue-50 p-2">
                  <p className="text-xs text-slate-600">5日後確定</p>
                  <p className="text-xl font-black">{report?.totalCompleted5d ?? 0}件</p>
                </div>
              </div>
              <p className="mt-2 text-xs leading-5 text-slate-600">
                同一銘柄の複数検出は別イベントとして集計。検証対象の銘柄数とは違います。
                1銘柄だけの過去勝率より広い比較ですが、5銘柄でも統計的には小規模です。
              </p>
              {report?.stocks.map(stock => (
                <p key={stock.code} className="mt-2 border-t border-slate-100 pt-2 text-sm">
                  <strong>{stock.code}</strong>　{stock.candles}本 ／{dateJst(stock.firstDate)}〜{dateJst(stock.latestDate)}
                  ／検出 {stock.detections}件（{stock.detectedKinds}種類）
                </p>
              ))}
              {excluded.length > 0 && (
                <div className="mt-3 rounded-lg bg-rose-50 p-3 text-xs font-bold text-rose-800">
                  除外した銘柄：{excluded.map(x => `${x.code}（${x.error}）`).join("、")}
                </div>
              )}
            </section>
            {report && (
              <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
                <h2 className="text-lg font-black">9種類の合算成績</h2>
                <p className="mt-2 text-xs leading-6 text-slate-600">
                  各パターンの方向一致率・平均方向騰落率は、検出日の終値と1・3・5営業日後の終値を比較した研究値。
                  <strong> 最悪値はその期間後の終値比較であり、途中の最大ドローダウンではありません。</strong>
                  未確定の未来足は計算に含めず、売買コスト・約定・税金は考慮しません。
                </p>
                <p className="mt-2 text-xs text-slate-600">
                  前半／後半の比較は同じデータを日付で分けただけで、独立した将来検証ではありません。
                  同一銘柄の連続シグナルや市場全体の値動きは相関するため、検出回数がそのまま独立した試行数にはなりません。
                </p>
                <div className="mt-3 space-y-3">
                  {ordered.map(row => {
                    const fifth = row.horizons[2];
                    return (
                      <article key={row.id} className="rounded-xl border border-slate-200 p-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <h3 className="text-sm font-black">{row.name}</h3>
                          <span className={`rounded-lg px-2 py-1 text-xs font-black ${row.direction === "BUY"
                            ? "bg-emerald-50 text-emerald-800" : "bg-rose-50 text-rose-800"}`}>
                            {row.direction === "BUY" ? "上昇方向" : "下落方向"}
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-slate-600">検出 {row.detections}件／{row.detectionStockCount}銘柄
                          ・5日後結果 {fifth.completed}件／{fifth.stockCount}銘柄</p>
                        <div className="mt-2 grid grid-cols-3 gap-1.5">
                          {row.horizons.map(value => <Horizon key={value.horizon} value={value}/>)}
                        </div>
                        <div className="mt-2 grid grid-cols-2 gap-2 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-950">
                          <p>期間前半の5日一致<br/><strong>{pct(fifth.early.winPercent)}</strong>（{fifth.early.count}件）</p>
                          <p>期間後半の5日一致<br/><strong>{pct(fifth.late.winPercent)}</strong>（{fifth.late.count}件）</p>
                        </div>
                        {fifth.completed < 20 && (
                          <p className="mt-2 text-[11px] font-bold text-amber-800">
                            検証件数20件未満：優劣の判断には使わないでください。
                          </p>
                        )}
                      </article>
                    );
                  })}
                </div>
              </section>
            )}
          </>
        )}
        <p className="mt-5 text-xs leading-6 text-slate-500">
          1・3・5営業日後とは、Yahooの日足データに存在する次の1・3・5本を指します。
          分割調整・上場廃止・欠損による偏り、相場状況、呼値、出来高などは完全には補正できません。
          検証値は売買助言でも、勝率や将来利益の保証でもありません。
          結果は保存せず、ページ更新時には再取得されます。
        </p>
      </div>
      <BottomNav/>
    </main>
  );
}
