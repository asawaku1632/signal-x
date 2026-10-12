"use client";

import Link from "next/link";
import { useMemo } from "react";
import type { ReboundCandle, ReboundOpportunity } from "@/app/lib/supportReboundResearch";
import {
  REBOUND_RISK_RULES, REBOUND_BAD_LOSS_PERCENT,
  assessReboundRiskRule, buildReboundRiskCases, inReboundRiskPhase,
} from "@/app/lib/research/supportReboundRiskStudy";
import type { RiskPhase, RiskRuleResult } from "@/app/lib/research/supportReboundRiskStudy";

type Study = {
  code: string;
  candles: ReboundCandle[];
  splitEvents: number[];
  result: { opportunities: ReboundOpportunity[] };
};
type Props = { studies: Study[]; busy: boolean; completed: number; expected: number; holdBars: number; phase: RiskPhase };
const number = (value: number) => value.toLocaleString("ja-JP", { maximumFractionDigits: 2 });
const rate = (value: number | null) => value === null ? "—" : number(value) + "%";
const signed = (value: number | null) => value === null ? "—" : (value > 0 ? "+" : "") + rate(value);
const date = (timestamp: number) => new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(timestamp * 1000));
const phaseNames: Record<RiskPhase, string> = { ALL: "全期間", TRAIN: "前半（2025/9までの決済）", TEST: "後半（2025/10以降の購入）" };

function MetricRow({ value }: { value: RiskRuleResult }) {
  const { eligible, rejected, retained, featureMissing } = value;
  return <tr className="border-t border-slate-100 text-xs sm:text-sm">
    <td className="px-2 py-3 font-bold">{REBOUND_RISK_RULES.find((rule) => rule.id === value.rule)?.shortLabel}</td>
    <td className="px-2 py-3 text-right">{eligible.count}<span className="block text-[10px] text-slate-400">不明 {featureMissing}</span></td>
    <td className="px-2 py-3 text-right">{rejected.count}<span className="block text-[10px] text-slate-500">損失除外 {value.removedMajorLosses}件</span></td>
    <td className="px-2 py-3 text-right">{retained.count}<span className="block text-[10px] text-slate-500">勝ちを除外 {value.removedWinners}件</span></td>
    <td className="px-2 py-3 text-right font-bold">{rate(eligible.majorLossRatePercent)} → {rate(retained.majorLossRatePercent)}</td>
    <td className="px-2 py-3 text-right">{rate(eligible.winRatePercent)} → {rate(retained.winRatePercent)}</td>
    <td className="px-2 py-3 text-right">{signed(eligible.averageReturnPercent)} → {signed(retained.averageReturnPercent)}</td>
  </tr>;
}

export default function SupportReboundRiskPanel({ studies, busy, completed, expected, holdBars, phase }: Props) {
  const cases = useMemo(() => buildReboundRiskCases(studies.map((study) => ({
    code: study.code, candles: study.candles, splitEvents: study.splitEvents,
    opportunities: study.result.opportunities,
  }))), [studies]);
  const summaries = useMemo(() => Object.fromEntries(
    (["ALL", "TRAIN", "TEST"] as RiskPhase[]).map((part) => [
      part,
      REBOUND_RISK_RULES.map((rule) => assessReboundRiskRule(cases, rule.id, part)),
    ]),
  ) as Record<RiskPhase, RiskRuleResult[]>, [cases]);
  const current = summaries[phase];
  const completedCases = cases.filter((item) => item.trade && inReboundRiskPhase(item.trade, phase));
  const severeCases = completedCases.filter((item) => item.trade!.returnPercent <= REBOUND_BAD_LOSS_PERCENT);
  const worst = [...severeCases].sort((a, b) => a.trade!.returnPercent - b.trade!.returnPercent).slice(0, 12);
  const pending = cases.filter((item) => !item.trade).length;
  const selected = current[3]; // ANY rule: same eligible denominator for before/after
  const known = selected.eligible.count;
  const preliminary = busy || completed < expected;
  return <section className="mt-5 rounded-2xl border border-rose-200 bg-white p-4 shadow-sm">
    <p className="text-xs font-black tracking-wider text-rose-600">SHADOW RESEARCH / OBSERVE ONLY</p>
    <h2 className="mt-2 text-xl font-black">🔬 ③の負けやすい条件を探す</h2>
    <p className="mt-2 text-sm leading-6 text-slate-600">
      出来高・50日移動平均・ボリンジャーバンドの特徴を、③が確定した時点の過去データだけで比較。
      {holdBars}営業日後の成績が -5%以下だったケースを「大きな負け」として数えます。
      どの条件も自動売買・AI採点・LINE通知には反映しません。
    </p>
    {preliminary && <p className="mt-3 rounded-xl bg-amber-50 p-3 text-xs text-amber-900">
      {completed}/{expected}銘柄の途中集計です。取得が完了するまで傾向を確定しないでください。
    </p>}
    <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
      <div className="rounded-xl bg-slate-50 p-3"><p className="text-xs text-slate-500">③の完了取引</p><p className="text-2xl font-black">{completedCases.length}件</p></div>
      <div className="rounded-xl bg-rose-50 p-3"><p className="text-xs text-rose-800">大きな負け（-5%以下）</p><p className="text-2xl font-black text-rose-800">{severeCases.length}件</p></div>
      <div className="rounded-xl bg-slate-50 p-3"><p className="text-xs text-slate-500">3指標すべて判定可能</p><p className="text-2xl font-black">{known}件</p></div>
      <div className="rounded-xl bg-slate-50 p-3"><p className="text-xs text-slate-500">結果待ち（全期間）</p><p className="text-2xl font-black">{pending}件</p></div>
    </div>
    <p className="mt-3 text-xs text-slate-500">分析対象：{phaseNames[phase]}。以下の「条件なし」は指標が取得できた取引に限定した比較で、欠損データを安全扱いしません。</p>
    <div className="mt-4 overflow-x-auto">
      <table className="w-full min-w-[890px] text-left text-xs">
        <thead><tr className="bg-slate-100 text-slate-700">
          <th className="px-2 py-3">暫定リスク条件</th>
          <th className="px-2 py-3 text-right">判定可能</th>
          <th className="px-2 py-3 text-right">除外</th>
          <th className="px-2 py-3 text-right">残す</th>
          <th className="px-2 py-3 text-right">大損率 前→後</th>
          <th className="px-2 py-3 text-right">勝率 前→後</th>
          <th className="px-2 py-3 text-right">平均騰落 前→後</th>
        </tr></thead>
        <tbody>{current.map((record) => <MetricRow key={record.rule} value={record} />)}</tbody>
      </table>
    </div>
    <p className="mt-2 text-xs leading-5 text-slate-500">
      除外した中に勝ち取引が何件あるかも表示。除外後の勝率や平均が上がっても、たまたまの可能性があります。
      利益合計は取引回数が異なるため優劣の直接比較に使いません。
    </p>
    <details className="mt-4 rounded-xl border border-slate-200 p-3">
      <summary className="cursor-pointer text-sm font-black">📅 前半と後半の再現性をチェック</summary>
      <p className="mt-2 text-xs leading-5 text-slate-500">
        同じ事前固定条件を前半・後半それぞれに当てはめます。後半を見て閾値を調整しないことが大切。
        この研究の条件は過去結果を見た後で決めているため、後半は厳密な意味での未使用データ検証ではありません。
      </p>
      {(["TRAIN", "TEST"] as RiskPhase[]).map((part) => <div key={part} className="mt-4">
        <h3 className="text-sm font-black">{phaseNames[part]}</h3>
        <div className="mt-2 overflow-x-auto">
          <table className="min-w-[700px] w-full text-left text-xs">
            <thead><tr className="bg-slate-100"><th className="p-2">条件</th><th className="p-2">判定可能</th><th className="p-2">除外</th><th className="p-2">大損率 前→後</th><th className="p-2">勝率 前→後</th><th className="p-2">平均騰落 前→後</th></tr></thead>
            <tbody>{summaries[part].map((r) => <tr className="border-t" key={r.rule}>
              <td className="p-2 font-bold">{REBOUND_RISK_RULES.find((item) => item.id === r.rule)?.shortLabel}</td>
              <td className="p-2">{r.eligible.count}</td><td className="p-2">{r.rejected.count}</td>
              <td className="p-2">{rate(r.eligible.majorLossRatePercent)} → {rate(r.retained.majorLossRatePercent)}</td>
              <td className="p-2">{rate(r.eligible.winRatePercent)} → {rate(r.retained.winRatePercent)}</td>
              <td className="p-2">{signed(r.eligible.averageReturnPercent)} → {signed(r.retained.averageReturnPercent)}</td>
            </tr>)}</tbody>
          </table>
        </div>
      </div>)}
    </details>
    <details className="mt-3 rounded-xl border border-slate-200 p-3">
      <summary className="cursor-pointer text-sm font-black">📉 大きく負けた取引の例（最大12件）</summary>
      {worst.length === 0 ? <p className="mt-2 text-sm text-slate-500">この期間の該当例はまだありません。</p> :
        <div className="mt-3 space-y-2">{worst.map((item) => <div key={item.code + item.hintTime} className="rounded-lg bg-slate-50 p-3 text-sm">
          <Link href={"/chart/" + item.code} className="font-bold text-blue-600">{item.code} ↗</Link>
          <span className="ml-2 text-xs text-slate-500">③ {date(item.hintTime)}</span>
          <p className="mt-1 font-bold text-rose-700">仮想騰落率 {signed(item.trade!.returnPercent)} ／ 保有中最大逆行 {signed(item.trade!.worstIntratradePercent)}</p>
          <p className="mt-1 text-xs text-slate-500">
            出来高比 {item.features.volumeRatio === null ? "不明" : number(item.features.volumeRatio) + "倍"} ／
            50日線との差 {signed(item.features.sma50GapPercent)} ／
            BB下限との差 {signed(item.features.bbLowerGapPercent)}
          </p>
        </div>)}</div>}
    </details>
    <p className="mt-4 border-t border-slate-100 pt-3 text-xs leading-6 text-slate-500">
      指標の定義：出来高はサイン当日の出来高÷直前20本の平均、移動平均は当日まで50本の終値単純平均、
      BB下限は当日まで20本の終値平均−2×標準偏差（母標準偏差）。株式分割が過去50本に重なる場合は欠損扱い。
      指標不足・出来高欠損を安全と判断しません。固定しきい値は探索用であり、勝率・利益・リスク改善を保証しません。
      同一相場日の銘柄間相関、上場銘柄の生存者バイアス、税・手数料・滑りにも注意。
      研究の数値はその時点の再取得データから計算し、DBには保存しません。
    </p>
  </section>;
}
