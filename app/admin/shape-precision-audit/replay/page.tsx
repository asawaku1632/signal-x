import Link from "next/link";
import { notFound } from "next/navigation";
import pool from "@/app/lib/postgres";
import BottomNav from "@/app/components/BottomNav";
import { getLearningOwnerSession } from "@/app/lib/learningOwner";
import {chartPatternCatalog,getChartPatternCatalogItem} from "@/app/lib/chartPatternCatalog";
import {detectChartPatterns} from "@/app/lib/chartPatternEngine";
import { SCAN_SNAPSHOT_KEY } from "@/app/lib/scanSnapshot";
import {
  classifyDoubleBottomReasons,
  doubleBottomStageLabel,
} from "@/app/lib/research/doubleBottomEvidence";

import {shapeReplayPolicy,shapeReferenceCandles,closedReferenceCandles} from "@/app/lib/research/shapeReplayTiming.mjs";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Candle = {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
};
type Evidence = {
  code: string;
  name: string;
  scanPrice: number | null;
  timestamp: string;
  reasons: string[] | null;
  barTimestamp: number | null;
  dataSource: string;
};
type ReplayResult = {
  low1: { price: number; index: number };
  low2: { price: number; index: number };
  neckline: number;
  lastClose: number;
  necklineBreak: boolean;
  nearNeckline: boolean;
};

function num(value: unknown): number | null {
  if (typeof value !== "number" && typeof value !== "string") return null;
  if (typeof value === "string" && !value.trim()) return null;
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function jstDate(value: number | string) {
  const date = typeof value === "string" ? new Date(value) : new Date(value * 1000);
  return date.toLocaleDateString("sv-SE", { timeZone: "Asia/Tokyo" });
}

async function loadEvidence(code: string, at: string, patternId: string): Promise<Evidence | null> {
  const result = await pool.query<{
    timestamp: Date | string;
    payload: unknown;
  }>(`
    SELECT d.updated_at AS timestamp, x.value AS payload
    FROM display_snapshots d
    CROSS JOIN LATERAL jsonb_array_elements(
      CASE WHEN jsonb_typeof(d.payload->'stocks')='array'
      THEN d.payload->'stocks' ELSE '[]'::jsonb END
    ) x(value)
    WHERE d.snapshot_key = $1 AND x.value->>'code' = $2
      AND EXISTS (
        SELECT 1 FROM jsonb_array_elements(
          CASE WHEN jsonb_typeof(x.value->'patternObservations')='array'
          THEN x.value->'patternObservations' ELSE '[]'::jsonb END
        ) p(value) WHERE p.value->>'id'=$3
      )
    LIMIT 1
  `, [SCAN_SNAPSHOT_KEY, code, patternId]);
  const row = result.rows[0];
  if (!row || !row.payload || typeof row.payload !== "object") return null;

  const timestamp = new Date(row.timestamp).toISOString();
  // Do not compare the user's old click to a newly overwritten scan.
  if (timestamp !== at) return null;
  const stock = row.payload as Record<string, unknown>;
  const displayed = Array.isArray(stock.detectedPatterns)
    ? stock.detectedPatterns.find((p) => p && typeof p === "object" && p.id === patternId) as Record<string, unknown> | undefined
    : undefined;
  const reasons = Array.isArray(displayed?.reasons)
    ? displayed.reasons.filter((x): x is string => typeof x === "string")
    : null;
  return {
    code,
    name: typeof stock.name === "string" ? stock.name : code,
    scanPrice: num(stock.price),
    timestamp,
    reasons,
    barTimestamp: num(stock.latestBarTimestamp),
    dataSource: typeof stock.dataSource === "string" ? stock.dataSource : "unknown",
  };
}

// One explicitly selected stock, one Yahoo daily OHLC request, no background
// scans, no database writes, and no automatic retries.
async function fetchDailyCandles(code: string, longHistory: boolean): Promise<{
  candles: Candle[];
  error: string | null;
}> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 4500);
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(code + ".T")}?range=${longHistory?"1y":"3mo"}&interval=1d`;
    const response = await fetch(url, {
      cache: "no-store",
      signal: controller.signal,
      headers: { "User-Agent": "Mozilla/5.0" },
    });
    if (!response.ok) return { candles: [], error: "日足データを取得できませんでした。既存のチャートで確認してください。" };
    const data: unknown = await response.json();
    if (!data || typeof data !== "object") throw new Error("invalid chart response");
    const chart = (data as Record<string, unknown>).chart as { result?: Array<{
      timestamp?: number[];
      indicators?: { quote?: Array<{ open?: unknown[]; high?: unknown[]; low?: unknown[]; close?: unknown[]; volume?: unknown[] }> };
    }> } | undefined;
    const result = chart?.result?.[0];
    const timestamps = result?.timestamp ?? [];
    const quote = result?.indicators?.quote?.[0];
    const candles: Candle[] = timestamps.flatMap((time, i) => {
      const open = num(quote?.open?.[i]);
      const high = num(quote?.high?.[i]);
      const low = num(quote?.low?.[i]);
      const close = num(quote?.close?.[i]);
      if (!open || !high || !low || !close || !Number.isFinite(time) ||
        high < Math.max(open, close, low) || low > Math.min(open, close, high)) return [];
      const v=quote?.volume?.[i];
      const volume=typeof v==="number"&&Number.isFinite(v)&&v>=0?v:undefined;
      return [{ time, open, high, low, close, volume }];
    }).slice(longHistory?-150:-90);
    return {
      candles,
      error: candles.length < 7
        ? "参考日足が不足しています。比較結果は表示できません。"
        : null,
    };
  } catch (error) {
    console.warn("private shape replay daily fetch failed", error instanceof Error ? error.message : "unknown");
    return { candles: [], error: "参考日足の取得に失敗しました。既存のチャートから確認してください。" };
  } finally {
    clearTimeout(timeout);
  }
}

// Read-only replay of the structural thresholds in detectDoubleBottom.
// It is NOT a replay of the original intraday decision or entire 55-pattern
// optimizer. The caller supplies the explicit reference cutoff.
function inspectEarlierDailyCandles(candles: Candle[]): ReplayResult | null {
  if (candles.length < 7) return null;
  const lows: Array<{ index: number; price: number }> = [];
  for (let i = 2; i < candles.length - 2; i++) {
    const local = candles.slice(i - 2, i + 3);
    if (candles[i].low <= Math.min(...local.map((c) => c.low))) {
      lows.push({ index: i, price: candles[i].low });
    }
  }
  const recent = lows.slice(-6);
  const lastClose = candles[candles.length - 1].close;
  for (let secondIndex = recent.length - 1; secondIndex >= 1; secondIndex--) {
    const second = recent[secondIndex];
    for (let firstIndex = secondIndex - 1; firstIndex >= 0; firstIndex--) {
      const first = recent[firstIndex];
      const distance = second.index - first.index;
      if (distance < 4 || distance > 60) continue;
      const difference = Math.abs(first.price - second.price) / Math.max(Math.abs(first.price), Math.abs(second.price), 0.0001);
      if (difference > 0.035 || lastClose < second.price * 1.01) continue;
      const neckline = Math.max(...candles.slice(first.index, second.index + 1).map((c) => c.high));
      return {
        low1: first,
        low2: second,
        neckline,
        lastClose,
        necklineBreak: lastClose >= neckline * 0.998,
        nearNeckline: lastClose >= neckline * 0.97,
      };
    }
  }
  return null;
}

function yen(value: number | null) {
  return value === null ? "—" : Math.round(value).toLocaleString("ja-JP") + "円";
}

function CandleChart({ candles, replay }: { candles: Candle[]; replay: ReplayResult | null }) {
  const tail = candles.slice(-40);
  if (!tail.length) return null;
  const width = 720;
  const height = 280;
  const left = 55;
  const right = 12;
  const top = 22;
  const bottom = 32;
  const high = Math.max(...tail.map((c) => c.high), replay?.neckline ?? 0);
  const low = Math.min(...tail.map((c) => c.low), replay?.neckline ?? Infinity);
  const range = Math.max(0.01, high - low);
  const y = (price: number) => top + (high - price) / range * (height - top - bottom);
  const x = (i: number) => left + (i + 0.5) * (width - left - right) / tail.length;
  const columnWidth = Math.max(4, Math.min(12, (width - left - right) / tail.length * 0.55));
  const firstIndex = candles.length - tail.length;

  return (
    <svg viewBox="0 0 720 280" role="img"
      aria-label="表示対象日までの参考日足。緑が陽線、赤が陰線。"
      className="h-auto w-full rounded-xl bg-white">
      {[0, 1, 2, 3, 4].map((i) => {
        const price = high - range * i / 4;
        const yy = y(price);
        return (
          <g key={i}>
            <line x1={left} x2={width - right} y1={yy} y2={yy} stroke="#e2e8f0" />
            <text x={left - 5} y={yy + 4} fontSize="11" textAnchor="end" fill="#475569">{Math.round(price).toLocaleString("ja-JP")}</text>
          </g>
        );
      })}
      {replay && (
        <>
          <line x1={left} x2={width - right} y1={y(replay.neckline)} y2={y(replay.neckline)}
            stroke="#d97706" strokeDasharray="6 5" strokeWidth="2"/>
          <text x={width - right - 4} y={y(replay.neckline) - 6}
            textAnchor="end" fontSize="11" fill="#92400e">参考ネックライン</text>
        </>
      )}
      {tail.map((c, i) => {
        const xx = x(i);
        const rising = c.close >= c.open;
        const color = rising ? "#059669" : "#dc2626";
        const bodyTop = Math.min(y(c.open), y(c.close));
        const bodyHeight = Math.max(1.8, Math.abs(y(c.open) - y(c.close)));
        const absoluteIndex = firstIndex + i;
        const lowMark = replay && [replay.low1.index, replay.low2.index].includes(absoluteIndex);
        return (
          <g key={c.time}>
            <line x1={xx} x2={xx} y1={y(c.high)} y2={y(c.low)} stroke={color} strokeWidth="2"/>
            <rect x={xx - columnWidth / 2} y={bodyTop} width={columnWidth} height={bodyHeight} fill={color}/>
            {lowMark && <circle cx={xx} cy={y(c.low) + 5} r="6" fill="none" stroke="#2563eb" strokeWidth="2"/>}
            {i % 10 === 0 && <text x={xx} y={height - 12} textAnchor="middle" fontSize="11" fill="#475569">{jstDate(c.time).slice(5)}</text>}
          </g>
        );
      })}
    </svg>
  );
}

type Props = { searchParams: Promise<{ code?: string; at?: string; pattern?: string }> };

export default async function PrivateShapeReplayPage({ searchParams }: Props) {
  const { isOwner } = await getLearningOwnerSession();
  if (!isOwner) notFound();

  const args = await searchParams;
  const code = args.code ?? "";
  const at = args.at ?? "";
  const patternId=args.pattern??"pattern002";
  const selected=getChartPatternCatalogItem(patternId);
  if(!selected)notFound();
  const isDoubleBottom=patternId==="pattern002";
  if (!/^[0-9A-Za-z]{4,5}$/.test(code) ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(at)) notFound();

  const evidence = await loadEvidence(code, at, patternId);
  if (!evidence) {
    return (
      <main className="mx-auto max-w-xl p-5">
        <h1 className="text-xl font-black">保存スキャンが更新されています</h1>
        <p className="mt-3 text-sm leading-6">古い検出記録と現在の株価を誤って比べないようにしています。最新の監査画面から選び直してください。</p>
        <Link href="/admin/shape-precision-audit" className="mt-4 block text-blue-700">← 監査画面へ戻る</Link>
      </main>
    );
  }
  const fetched = await fetchDailyCandles(code, !isDoubleBottom);
  const policy=shapeReplayPolicy(evidence.timestamp,evidence.barTimestamp,evidence.dataSource)!;
  const closed=closedReferenceCandles(fetched.candles,Date.now()) as Candle[];
  const candles=shapeReferenceCandles(closed,policy) as Candle[];
  const error=fetched.error||(candles.length<7?"照合対象日までの日足が不足しています。":null);
  const latest=closed.at(-1)??null;
  const followup=closed.filter(c=>jstDate(c.time)>jstDate(evidence.timestamp));
  const retrievedAt=new Date().toLocaleString("ja-JP",{timeZone:"Asia/Tokyo"});
  const replay = error||!isDoubleBottom ? null : inspectEarlierDailyCandles(candles);
  const last = candles[candles.length - 1] ?? null;
  const originalStage = classifyDoubleBottomReasons(evidence.reasons);
  const dailyUnsupported=patternId==="pattern028";
  const referenceMatches=error||dailyUnsupported?[]:detectChartPatterns(candles).filter(p=>selected.engineNames.includes(p.name));
  const latestMatches=fetched.error||dailyUnsupported?[]:detectChartPatterns(closed).filter(p=>selected.engineNames.includes(p.name));
  const volumeMissing=candles.some(c=>c.volume===undefined);

  return (
    <main className="min-h-screen bg-slate-50 pb-28 text-slate-900">
      <div className="mx-auto max-w-3xl px-3 pt-5 sm:px-6">
        <Link href="/admin/shape-precision-audit" className="text-sm font-black text-blue-700">← 検出精度監査へ戻る</Link>
        <h1 className="mt-4 text-2xl font-black">🔬 参考日足で照合</h1>
        <p className="mt-2 text-lg font-black">{evidence.name}（{evidence.code}）</p>
        <p className="mt-1 text-sm font-black text-blue-800">照合する形：{selected.name}</p>
        <section className="mt-4 rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm leading-7">
          <h2 className="font-black">元の判定は{policy.sourceLabel} ／ 下の図は参考日足</h2>
          <p>スキャン保存：{new Date(evidence.timestamp).toLocaleString("ja-JP",{timeZone:"Asia/Tokyo"})}（日本時間）</p>
          <p>判定元の最終足：{policy.barTimestamp?new Date(policy.barTimestamp*1000).toLocaleString("ja-JP",{timeZone:"Asia/Tokyo"}):"時刻未保存"} ／ 保存価格 {yen(evidence.scanPrice)}</p>
          <p>保存された判定：{isDoubleBottom?doubleBottomStageLabel(originalStage):selected.name}
            {!isDoubleBottom&&evidence.reasons?.length?<span className="block text-xs">{evidence.reasons.join(" ／ ")}</span>:null}</p>
          <p>{policy.includeAnchor
            ?policy.anchor+"の大引けまでの足を保存データで確認できるため、同日の日足も照合対象に含めます。"
            :policy.anchor+"当日の完成日足を使えたと確認できないため、その日より前の日足で照合します。"}</p>
          <p className="text-xs text-slate-600">日足は今回取得した参考データです。元の判定入力を保存したものではないため、足種や修正株価の違いで判定が異なる場合があります。保存日時は検出開始時刻とは限りません。</p>
        </section>

        <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
          <h2 className="text-lg font-black">保存時点までの参考日足（最大40本表示）</h2>
          {error ? <p className="mt-3 text-sm font-bold text-red-700">{error}</p> : (
            <>
              <p className="mt-2 text-xs text-slate-600">参考データ最終日：{last ? jstDate(last.time) : "—"} ／日足OHLC {candles.length}本</p>
              <div className="mt-3 overflow-hidden rounded-xl border border-slate-100">
                <CandleChart candles={candles} replay={replay}/>
              </div>
              {isDoubleBottom?<p className="mt-2 text-xs text-slate-600">青丸：参考日足で見つけた底候補。橙破線：参考ネックライン。</p>:<p className="mt-2 text-xs text-slate-600">実際の参考日足を表示。選択した形の判定理由は下に表示します。形の位置を示す丸・ラインは、この形ではまだ表示しません。</p>}
            </>
          )}
        </section>

        {!error && isDoubleBottom && (
          <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
            <h2 className="font-black">日足で見た形の確認</h2>
            {!replay ? <p className="mt-2 text-sm leading-6">対象日までの日足では、安値2つの基本条件に一致しませんでした。元の足種が異なる場合、その判定との直接比較はできません。</p> : (
              <>
                <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                  <p className="rounded-lg bg-slate-50 p-3">第1の安値（{jstDate(candles[replay.low1.index].time)}）<br/><strong>{yen(replay.low1.price)}</strong></p>
                  <p className="rounded-lg bg-slate-50 p-3">第2の安値（{jstDate(candles[replay.low2.index].time)}）<br/><strong>{yen(replay.low2.price)}</strong></p>
                  <p className="rounded-lg bg-slate-50 p-3">参考ネックライン<br/><strong>{yen(replay.neckline)}</strong></p>
                  <p className="rounded-lg bg-slate-50 p-3">参考最終終値<br/><strong>{yen(replay.lastClose)}</strong></p>
                </div>
                <p className="mt-2 text-sm font-bold">
                  {replay.necklineBreak ? "対象日までの参考日足でネックライン突破相当" :
                    replay.nearNeckline ? "対象日までの参考日足でネックライン付近" :
                    "対象日までの参考日足では反発候補"}
                </p>
              </>
            )}
            <p className="mt-2 text-xs leading-6 text-slate-500">
              これは参考日足の安値ペア・3.5%以内・4～60本・1%以上の反発のみを照合した研究表示です。
              元の5分足などの判定入力や55種類全体のスコアは再現していません。ネックライン突破相当は、終値が線の99.8%以上という既存研究条件で、厳密な上抜けと異なります。
            </p>
          </section>
        )}
        {!isDoubleBottom&&<section className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 text-sm leading-6">
          <h2 className="font-black">{selected.name}・日足での確認</h2>
          <p className="mt-2">{selected.summary}</p>
          <p className="mt-2 font-bold">{error?"日足取得待ち":dailyUnsupported?"この形は分足専用のため、日足照合の対象外です。":referenceMatches.length?"対象日までの参考日足で条件一致":"対象日までの参考日足では条件一致なし"}</p>
          {referenceMatches.map(p=><div key={p.id} className="mt-2 rounded-lg bg-blue-50 p-3">
            <p className="font-bold">{p.name} ／ {p.direction==="BUY"?"上昇方向":p.direction==="SELL"?"下落方向":"方向未確定"}</p>
            {p.reasons.map((reason,i)=><p key={i}>・{reason}</p>)}
          </div>)}
          <details className="mt-3"><summary className="cursor-pointer font-bold">この形で確認する条件</summary>
            <ul className="mt-2 list-disc pl-5">{selected.formation.map(item=><li key={item}>{item}</li>)}</ul>
          </details>
          <p className="mt-2 text-xs text-slate-600">元の{policy.sourceLabel}判定と足種が違う場合、一致しなくても誤検出の確定にはなりません。
            {volumeMissing?"出来高に欠損があり、出来高条件を含む形の照合は制限されます。":""}</p>
        </section>}
        {!fetched.error&&<section className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 text-sm leading-6">
          <h2 className="font-black">その後・直近の日足はどうなった？</h2>
          <p>取得日時 {retrievedAt} ／ 最新の対象日 {latest?jstDate(latest.time):"—"}</p>
          <p>最新終値 {yen(latest?.close??null)}</p>
          {latest&&replay&&<p className="mt-2 font-bold">照合したネックライン {yen(replay.neckline)}に対し、
            {latest.close>replay.neckline?"終値は上":latest.close===replay.neckline?"終値は同値":"終値は下"}です。
            {latest.close<replay.low2.price?"第2の安値も下回っています。":""}</p>}
          {isDoubleBottom?<p className="mt-1 text-xs text-slate-600">元の参考ネックラインを固定して比較しています。新しいダブルボトムの成立や、場中の上昇継続を判定した表示ではありません。</p>:<p className="mt-2 font-bold">直近の日足：{dailyUnsupported?"分足専用のため判定対象外":latestMatches.length?selected.name+"の条件一致":selected.name+"の条件一致なし"}<span className="block text-xs font-normal text-slate-600">直近の日足での別判定です。元の形が連続して維持されたことを示すものではありません。</span></p>}
          <div className="mt-3 grid grid-cols-3 gap-2">{[1,3,5].map(n=>{
            const c=followup[n-1];
            return <div key={n} className="rounded-lg bg-slate-50 p-2">
              <p className="font-bold">保存日から{n}取引日後</p>
              <p>{c?jstDate(c.time):"日足待ち"}</p><p>{yen(c?.close??null)}</p>
              {c&&last&&<p>{((c.close/last.close-1)*100).toFixed(2)}%</p>}
            </div>;
          })}</div>
          <p className="mt-2 text-xs text-slate-600">％は照合対象最終日（{last?jstDate(last.time):"—"}）の参考終値比。売買損益ではありません。価格のある取引日を数え、当日16時前の日足は除外します。</p>
        </section>}
        <div className="mt-4 flex flex-wrap gap-2">
          <Link href={`/chart/${code}`} className="grid min-h-11 place-items-center rounded-xl bg-blue-700 px-4 text-sm font-black text-white">通常のチャートを見る</Link>
          <Link href={`/analysis/${code}`} className="grid min-h-11 place-items-center rounded-xl border border-blue-300 px-4 text-sm font-black text-blue-700">AI解析</Link>
        </div>
        <p className="mt-5 text-xs leading-5 text-slate-500">
          読み取り専用：ボタンを押したときに選択した1銘柄のYahoo日足を1回取得する方式。
          DBへの保存、再スキャン、通知、AI POWERの変更は行いません。
        </p>
      </div>
      <BottomNav/>
    </main>
  );
}
