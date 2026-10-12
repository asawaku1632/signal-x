"use client";

import Link from "next/link";
import { useMemo } from "react";
import type { ReboundCandle, ReboundOpportunity } from "@/app/lib/supportReboundResearch";
import {
  REBOUND_SCORE_VERSION, buildScoredHints, compareRiskScore,
} from "@/app/lib/research/supportReboundRiskScore";
import type { ScoredHint, ScoreMetrics, RiskBand } from "@/app/lib/research/supportReboundRiskScore";
import type { RiskPhase } from "@/app/lib/research/supportReboundRiskStudy";

type Study = {
  code: string; candles: ReboundCandle[]; splitEvents: number[];
  result: { opportunities: ReboundOpportunity[] };
};
type Props = { studies: Study[]; busy: boolean; completed: number; expected: number; holdBars: number; phase: RiskPhase };
const fmt = (n: number) => n.toLocaleString("ja-JP", { maximumFractionDigits: 2 });
const pct = (n: number | null) => n === null ? "—" : (n > 0 ? "+" : "") + fmt(n) + "%";
const plainPct = (n: number | null) => n === null ? "—" : fmt(n) + "%";
const names: Record<RiskBand, string> = { LOW: "低（0〜29点）", MID: "中（30〜59点）", HIGH: "高（60〜100点）" };
const date = (t: number) => new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(t * 1000));
function BandCard({ band, data }: { band: RiskBand; data: ScoreMetrics }) {
  return <article className="rounded-xl border border-slate-200 bg-slate-50 p-3">
    <p className="text-sm font-black">{names[band]}</p>
    <p className="mt-2 text-xl font-black">{data.count}件</p>
    <div className="mt-1 space-y-1 text-xs">
      <p>勝率：<strong>{plainPct(data.winPercent)}</strong></p>
      <p>大損率（-5%以下）：<strong>{plainPct(data.bigLossPercent)}</strong></p>
      <p>平均騰落：<strong>{pct(data.avgPercent)}</strong></p>
      <p>最悪の取引：{pct(data.worstPercent)}</p>
    </div>
  </article>;
}

export default function SupportReboundScorePanel({ studies, busy, completed, expected, holdBars, phase }: Props) {
  const scores = useMemo(() => buildScoredHints(studies.map((s) => ({
    code: s.code, candles: s.candles, splitEvents: s.splitEvents,
    opportunities: s.result.opportunities,
  }))), [studies]);
  const comparisons = useMemo(() => ({
    ALL: compareRiskScore(scores, "ALL"),
    TRAIN: compareRiskScore(scores, "TRAIN"),
    TEST: compareRiskScore(scores, "TEST"),
  }), [scores]);
  const current = comparisons[phase];
  const latestPending = useMemo(() => scores.filter((x) => !x.trade)
    .sort((a, b) => b.hintTime - a.hintTime).slice(0, 12), [scores]);
  const severe = useMemo(() => scores.filter((x): x is ScoredHint & { trade: NonNullable<ScoredHint["trade"]> } =>
    x.trade !== null && x.trade.returnPercent <= -5 && x.score !== null)
    .sort((a, b) => a.trade.returnPercent - b.trade.returnPercent).slice(0, 10), [scores]);
  const preliminary = busy || completed !== expected;
  return <section className="mt-5 rounded-2xl border border-indigo-200 bg-white p-4 shadow-sm">
    <p className="text-xs font-black tracking-widest text-indigo-700">EXPERIMENTAL / READ ONLY / {REBOUND_SCORE_VERSION}</p>
    <h2 className="mt-2 text-xl font-black">🧠 ③ 大損リスクスコア・隔離研究</h2>
    <p className="mt-2 text-sm leading-6 text-slate-600">
      RSI14、ATR14、50日線の傾き、出来高、BB下限の5つを組み合わせた仮の危険度（0〜100点）。
      点数は大損確率ではなく、現在は根拠を探すための実験用分類です。今のAI採点・売買判断・通知には反映しません。
    </p>
    {preliminary && <p className="mt-3 rounded-xl bg-amber-50 p-3 text-xs font-bold text-amber-900">
      取得途中：{completed} / {expected}銘柄。全銘柄が完了するまで結果は暫定です。
    </p>}
    <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
      <div className="rounded-xl bg-indigo-50 p-3"><p className="text-xs text-indigo-800">③ 完了取引</p><p className="text-2xl font-black">{current.completed}件</p></div>
      <div className="rounded-xl bg-slate-50 p-3"><p className="text-xs text-slate-600">スコア計算可能</p><p className="text-2xl font-black">{current.known.count}件</p></div>
      <div className="rounded-xl bg-slate-50 p-3"><p className="text-xs text-slate-600">データ不足・分割など</p><p className="text-2xl font-black">{current.unknown}件</p></div>
    </div>
    <p className="mt-4 text-xs font-bold text-slate-600">点数別の実績（{phase === "ALL" ? "全期間" : phase === "TRAIN" ? "前半" : "後半"}・{holdBars}営業日保有）</p>
    <div className="mt-2 grid gap-2 sm:grid-cols-3">
      {current.bands.map((entry) => <BandCard key={entry.band} band={entry.band} data={entry.metrics} />)}
    </div>
    <div className="mt-4 rounded-xl border border-indigo-100 p-3">
      <h3 className="text-sm font-black">🧪 仮に「高リスク60点以上」を除外したら？</h3>
      <p className="mt-1 text-xs text-slate-500">全体ではなく、スコア算出可能な同じ取引だけで比較。中・低を残す仮説の実績です。</p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <div className="rounded-lg bg-slate-50 p-3 text-xs">
          <strong>除外前：{current.known.count}件</strong>
          <p className="mt-1">勝率 {plainPct(current.known.winPercent)}</p>
          <p>大損率 {plainPct(current.known.bigLossPercent)}</p>
          <p>平均騰落 {pct(current.known.avgPercent)}</p>
        </div>
        <div className="rounded-lg bg-indigo-50 p-3 text-xs">
          <strong>除外後：{current.retained.count}件</strong>
          <p className="mt-1">勝率 {plainPct(current.retained.winPercent)}</p>
          <p>大損率 {plainPct(current.retained.bigLossPercent)}</p>
          <p>平均騰落 {pct(current.retained.avgPercent)}</p>
        </div>
      </div>
      <p className="mt-3 text-sm">除外：<strong>{current.excluded.count}件</strong> ／ 大損を除外：<strong>{current.excludedBigLosses}件</strong> ／ 勝ちも除外：<strong>{current.excludedWinners}件</strong></p>
      <p className="mt-2 text-xs text-slate-500">除外は実際に行っていません。平均が上昇しても取引回数が減るため、利益合計や運用成績の改善を意味しません。</p>
    </div>
    <details className="mt-3 rounded-xl border border-slate-200 p-3">
      <summary className="cursor-pointer text-sm font-black">📅 前半・後半の同じ採点ルールを比較</summary>
      <p className="mt-2 text-xs text-slate-500">どちらも現在の研究で決めた同じ配点です。前半だけで学習したモデルではなく、後半も厳密な未使用データではありません。</p>
      {(["TRAIN", "TEST"] as const).map((part) => {
        const data = comparisons[part];
        return <div key={part} className="mt-4">
          <h3 className="text-sm font-black">{part === "TRAIN" ? "前半：2025年9月までの決済" : "後半：2025年10月以降の購入"}</h3>
          <div className="mt-2 overflow-x-auto"><table className="w-full min-w-[590px] text-left text-xs">
            <thead><tr className="bg-slate-100"><th className="p-2">危険度</th><th className="p-2">件数</th><th className="p-2">勝率</th><th className="p-2">大損率</th><th className="p-2">平均騰落</th></tr></thead>
            <tbody>{data.bands.map((row) => <tr className="border-t" key={row.band}>
              <td className="p-2">{names[row.band]}</td><td className="p-2">{row.metrics.count}</td>
              <td className="p-2">{plainPct(row.metrics.winPercent)}</td><td className="p-2">{plainPct(row.metrics.bigLossPercent)}</td>
              <td className="p-2">{pct(row.metrics.avgPercent)}</td>
            </tr>)}</tbody>
          </table></div>
          <p className="mt-1 text-xs text-slate-500">完了 {data.completed}件／スコア不明 {data.unknown}件。高を除外すると大損 {data.excludedBigLosses}件を除外、勝ち {data.excludedWinners}件も除外。</p>
        </div>;
      })}
    </details>
    <details className="mt-3 rounded-xl border border-slate-200 p-3">
      <summary className="cursor-pointer text-sm font-black">📉 大きく負けたケースの採点例（最大10件）</summary>
      {severe.length === 0 && <p className="mt-2 text-xs">該当する完了取引はまだありません。</p>}
      <div className="mt-3 space-y-2">{severe.map((x) => <div key={x.code + x.hintTime} className="rounded-lg bg-slate-50 p-3 text-xs">
        <Link href={"/chart/" + x.code} className="font-black text-blue-600">{x.code} ↗</Link>
        <span className="ml-2 text-slate-500">③ {date(x.hintTime)}</span>
        <p className="mt-1 font-bold text-rose-700">仮想結果 {pct(x.trade.returnPercent)} ／ 当時のリスクスコア {x.score}点（{x.band ? names[x.band] : "不明"}）</p>
        <p className="mt-1 text-slate-600">RSI {x.features?.rsi14 ?? "—"} ／ ATR {pct(x.features?.atr14Percent ?? null)} ／ SMA傾き {pct(x.features?.sma50Slope10Percent ?? null)} ／ 出来高 {x.features?.volumeRatio20 ?? "—"}倍</p>
      </div>)}</div>
    </details>
    <details className="mt-3 rounded-xl border border-slate-200 p-3">
      <summary className="cursor-pointer text-sm font-black">🕒 まだ答えが出ていない③の参考スコア（最大12件）</summary>
      <p className="mt-2 text-xs text-slate-500">取得済みの日足で検出した③のうち、{holdBars}営業日先の仮想結果がまだ揃っていないもの。翌営業日の実際の購入を推奨する表示ではありません。自動保存・未来追跡はせず、再検証すると再計算します。</p>
      <div className="mt-3 space-y-2">
        {latestPending.length === 0 && <p className="text-xs text-slate-500">結果待ちの③はありません。</p>}
        {latestPending.map((x) => <div key={x.code + x.hintTime} className="rounded-lg bg-slate-50 p-3 text-xs">
          <Link href={"/chart/" + x.code} className="font-black text-blue-600">{x.code} ↗</Link>
          <span className="ml-2 text-slate-500">③ {date(x.hintTime)}</span>
          <span className="ml-2 font-bold">{x.score === null ? "算出不可" : x.score + "点（" + names[x.band!] + "）"}</span>
        </div>)}
      </div>
    </details>
    <p className="mt-4 border-t border-slate-100 pt-3 text-xs leading-6 text-slate-500">
      v1固定配点（最大100点）：薄い出来高15点、50日線の10日傾き25点、ATR14を終値で割った変動率25点、
      RSI14の極端な水準20点、BB20下限割れ15点。RSI14・ATR14はWilder方式、60本の確定日足から計算。
      いずれかの入力不足・株式分割・データ異常は「算出不可」で、低リスク扱いにはしません。
      30点・60点の境界も含め、結果を見て最適化していない暫定仮説です。スコアは大損確率ではありません。
      過去データでの探索には選択バイアスがあり、今後の独立した未来検証が必要です。
      DB保存・追加API・Cron・AI判定・通知・取引機能への影響はありません。
    </p>
  </section>;
}
