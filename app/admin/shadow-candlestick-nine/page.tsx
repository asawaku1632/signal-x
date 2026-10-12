import Link from "next/link";
import { notFound } from "next/navigation";
import BottomNav from "@/app/components/BottomNav";
import { getLearningOwnerSession } from "@/app/lib/learningOwner";
import {
  SHADOW_CANDLE_PATTERNS,
  studyShadowCandlePatterns,
  type ShadowCandle,
} from "@/app/lib/research/shadowCandlestickNine";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type PageProps = { searchParams: Promise<{ code?: string }> };

function dateJst(unixSeconds: number) {
  return new Date(unixSeconds * 1000).toLocaleDateString("sv-SE", { timeZone: "Asia/Tokyo" });
}

function todayJst() {
  return new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Tokyo" });
}

function finitePositive(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) return null;
  return value;
}

async function fetchOneDailyHistory(code: string): Promise<{ candles: ShadowCandle[]; error: string | null }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const response = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(code + ".T")}?range=6mo&interval=1d`,
      { cache: "no-store", signal: controller.signal, headers: { "User-Agent": "Mozilla/5.0" } },
    );
    if (!response.ok) return { candles: [], error: "Yahoo参考日足の取得に失敗しました。" };
    const json: unknown = await response.json();
    const raw = json as { chart?: { result?: Array<{
      timestamp?: unknown;
      indicators?: { quote?: Array<{
        open?: unknown; high?: unknown; low?: unknown; close?: unknown; volume?: unknown;
      }> };
    }>; error?: unknown } };
    if (raw?.chart?.error || !Array.isArray(raw?.chart?.result)) throw new Error("invalid Yahoo response");
    const series = raw.chart.result[0];
    const timestamps = series?.timestamp;
    const quote = series?.indicators?.quote?.[0];
    if (!Array.isArray(timestamps) || !quote ||
      !Array.isArray(quote.open) || !Array.isArray(quote.high) ||
      !Array.isArray(quote.low) || !Array.isArray(quote.close)) {
      throw new Error("missing OHLC");
    }
    const cutoff = todayJst(); // Never inspect an incomplete present-day bar.
    const candles: ShadowCandle[] = [];
    for (let i = 0; i < timestamps.length; i++) {
      const time = finitePositive(timestamps[i]);
      const open = finitePositive(quote.open[i]);
      const high = finitePositive(quote.high[i]);
      const low = finitePositive(quote.low[i]);
      const close = finitePositive(quote.close[i]);
      if (!time || !open || !high || !low || !close ||
        high < Math.max(open, low, close) || low > Math.min(open, high, close) ||
        dateJst(time) >= cutoff) continue;
      // One row per trading date; prevents duplicate candles from inflating outcomes.
      if (candles.length && dateJst(candles[candles.length - 1].time) >= dateJst(time)) continue;
      candles.push({
        time, open, high, low, close,
        volume: Array.isArray(quote.volume) ? finitePositive(quote.volume[i]) ?? undefined : undefined,
      });
    }
    return {
      candles: candles.slice(-135),
      error: candles.length < 20 ? "有効な確定済み日足が20本未満です。研究計算は行えません。" : null,
    };
  } catch (error) {
    console.warn("owner-only candlestick research Yahoo failure", error instanceof Error ? error.message : "unknown");
    return { candles: [], error: "参考日足を取得できませんでした。時間を置いて再度お試しください。" };
  } finally {
    clearTimeout(timeout);
  }
}

function signed(value: number | null) {
  return value === null ? "未確定" : `${value > 0 ? "+" : ""}${value.toFixed(2)}%`;
}

export default async function ShadowCandlestickNinePage({ searchParams }: PageProps) {
  const { isOwner } = await getLearningOwnerSession();
  if (!isOwner) notFound();

  const requested = (await searchParams).code?.trim().toUpperCase() ?? "";
  const validCode = /^[0-9A-Z]{4,5}$/.test(requested);
  // No background fetch when the page is opened, only when an owner selects
  // a well-formed, single stock code and submits the form.
  const { candles, error } = validCode
    ? await fetchOneDailyHistory(requested)
    : { candles: [] as ShadowCandle[], error: requested ? "銘柄コードは英数字4〜5文字で入力してください。" : null };
  const studies = error || !validCode ? [] : studyShadowCandlePatterns(candles);
  const firstDay = candles.length ? dateJst(candles[0].time) : null;
  const lastDay = candles.length ? dateJst(candles[candles.length - 1].time) : null;
  const totalHits = studies.reduce((n, study) => n + study.hits.length, 0);

  return (
    <main className="min-h-screen bg-slate-50 pb-28 text-slate-900">
      <div className="mx-auto max-w-4xl px-3 pt-5 sm:px-6">
        <Link href="/admin/learning-hub" className="text-sm font-black text-blue-700">← 学習管理へ戻る</Link>
        <h1 className="mt-4 text-2xl font-black">🕯️ ローソク足9種類・隔離研究</h1>
        <p className="mt-2 text-sm leading-7 text-slate-600">
          写真の「つつみ線・はらみ線・出会い線・毛抜き天井／底・切り込み線」の9種類を研究します。
          既存の「被せ線」は本番55パターンに実装済みのため二重追加しません。
        </p>
        <section className="mt-4 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm leading-6 text-amber-950">
          <p className="font-black">🔒 本人専用 / SHADOW ONLY / 保存・通知なし</p>
          <p className="mt-2">
            1銘柄の<strong>完成済み過去日足のみ</strong>を、その場で1回取得して解析します。
            AI POWER・本番の55形状・LINE通知・売買判定・学習DBは一切変更しません。
            実績は今回読み込んだ1銘柄の過去6か月に限定され、全市場の統計や将来の勝率ではありません。
          </p>
          <p className="mt-2">元画像は形を学ぶための参考例です。「底値圏なら必ず上昇」「高値圏なら必ず下落」という意味ではありません。</p>
        </section>

        <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
          <form action="/admin/shadow-candlestick-nine" method="get" className="flex flex-wrap items-end gap-3">
            <label className="min-w-[160px] flex-1 text-sm font-black">
              調べる銘柄コード（1銘柄だけ）
              <input name="code" type="text" pattern="[0-9A-Za-z]{4,5}" maxLength={5}
                defaultValue={requested} placeholder="例：3182" autoComplete="off"
                className="mt-2 h-12 w-full rounded-xl border border-slate-300 px-3 text-base"
                required />
            </label>
            <button type="submit" className="min-h-12 rounded-xl bg-blue-700 px-5 text-sm font-black text-white">
              研究する
            </button>
          </form>
          <p className="mt-2 text-xs leading-5 text-slate-600">
            ページを開くだけでは株価の取得は行いません。「研究する」を押すと選択した1銘柄だけ日足を取得します。
          </p>
        </section>

        {error && <p role="alert" className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm font-bold text-rose-800">{error}</p>}
        {validCode && !error && (
          <>
            <section className="mt-4 rounded-2xl border border-blue-200 bg-white p-4">
              <h2 className="text-lg font-black">{requested} の研究結果</h2>
              <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                <div className="rounded-xl bg-blue-50 p-3">
                  <p className="text-xs text-slate-600">確定日足</p>
                  <p className="text-xl font-black">{candles.length}本</p>
                </div>
                <div className="rounded-xl bg-blue-50 p-3">
                  <p className="text-xs text-slate-600">検出延べ回数</p>
                  <p className="text-xl font-black">{totalHits}件</p>
                </div>
                <div className="rounded-xl bg-blue-50 p-3">
                  <p className="text-xs text-slate-600">検出した種類</p>
                  <p className="text-xl font-black">{studies.filter(x => x.hits.length).length}/9</p>
                </div>
              </div>
              <p className="mt-3 text-xs text-slate-600">分析対象：{firstDay}〜{lastDay}（日本時間）。同じ2本が複数種類に重なる可能性があります。</p>
            </section>
            <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
              <h2 className="text-lg font-black">1・3・5営業日後の研究成績</h2>
              <p className="mt-2 text-xs leading-6 text-slate-600">
                検出日の終値を仮の基準とし、N営業日後の終値と比較。上昇型は値上がり、下落型は値下がりを方向一致とします。
                <strong> 確定していない未来の足は成績から除外</strong>します。方向一致率は実際の取引勝率ではなく、
                手数料・税金・約定価格・スプレッドを含みません。
              </p>
              <div className="mt-4 space-y-4">
                {studies.map(({ definition, hits, horizons }) => (
                  <article key={definition.id} className="rounded-xl border border-slate-200 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h3 className="text-sm font-black">{definition.name}</h3>
                      <span className={`rounded-lg px-2 py-1 text-xs font-black ${definition.direction === "BUY"
                        ? "bg-emerald-50 text-emerald-800" : "bg-rose-50 text-rose-800"}`}>
                        {definition.direction === "BUY" ? "上昇方向" : "下落方向"}
                      </span>
                    </div>
                    <p className="mt-1 text-xs leading-5 text-slate-600">{definition.explanation}</p>
                    <p className="mt-1 text-xs font-black text-slate-800">過去の検出：{hits.length}件</p>
                    <div className="mt-2 grid grid-cols-3 gap-1.5">
                      {horizons.map(h => (
                        <div key={h.horizon} className="rounded-lg bg-slate-50 px-1.5 py-3 text-center">
                          <p className="text-[11px] font-bold text-slate-600">{h.horizon}営業日後</p>
                          <p className="mt-1 text-sm font-black">{h.winRatePercent === null ? "—" : h.winRatePercent.toFixed(1) + "%"}</p>
                          <p className="text-[10px] text-slate-600">方向一致 {h.success}/{h.completed}件</p>
                          <p className="mt-1 text-[11px] font-bold text-blue-700">
                            {signed(h.averageDirectionalReturnPercent)}
                          </p>
                          <p className="text-[10px] text-slate-600">平均方向騰落率</p>
                        </div>
                      ))}
                    </div>
                    {hits.length > 0 && (
                      <details className="mt-2 rounded-lg bg-slate-50 p-3 text-xs">
                        <summary className="cursor-pointer font-black text-blue-700">直近の検出日・判定理由を見る</summary>
                        <div className="mt-2 space-y-2">
                          {[...hits].reverse().slice(0, 5).map(hit => (
                            <p key={hit.time} className="border-t border-slate-200 pt-2 leading-6">
                              <strong>{dateJst(hit.time)}</strong>　{hit.location}
                              ／終値 {Math.round(hit.entryClose).toLocaleString("ja-JP")}円
                              ／{hit.reasons.join("・")}
                            </p>
                          ))}
                        </div>
                      </details>
                    )}
                  </article>
                ))}
              </div>
            </section>
          </>
        )}
        <p className="mt-5 text-xs leading-6 text-slate-500">
          研究用の暫定条件：先行12本の値幅が2.5%以上、10本超の変化が上下2%以上などで高値圏・安値圏を推定し、
          2本の実体・価格差を照合します。銘柄ごとの呼値・株式分割・取引停止や当時の出来高相場などは十分に考慮できていません。
          データの取得や検出はその場限りで、将来の自動追跡・勝率の永続保存はまだ行いません。
        </p>
      </div>
      <BottomNav />
    </main>
  );
}
