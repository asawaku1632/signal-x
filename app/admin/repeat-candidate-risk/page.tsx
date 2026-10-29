"use client";

import { useEffect, useMemo, useState } from "react";
import { summarizeGroup, withoutLargestDay, sameDayComparison, outcomeCoverageByDate, matchedDaySensitivity, assessedOutcomeCoverage, thresholdSensitivity, outcomeDateIntegrity, excludeUnverifiedDatedOutcomes, outcomeCalendarAudit, weekdayGapAudit } from "@/app/lib/research/repeatCandidateStats";

type Row = {
  trade_date: string; code: string; name: string;
  ai_power: number | string; entry_price: number | string;
  return_5d: number | string | null; outcome_5d_date: string | null;
  previous_candidate_date: string; previous_candidate_price: number | string;
  previous_candidate_change_pct: number | string | null;
  previous_candidate_drop_over_5pct: boolean;
};
type Response = { success: boolean; rows?: Row[]; truncated?: boolean; note?: string; error?: string; fetchedAt?: string };
const n = (v: number | string | null) => {
  if (v == null || (typeof v === "string" && v.trim() === "")) return null;
  const parsed = Number(v);
  return Number.isFinite(parsed) ? parsed : null;
};
const pct = (v: number | string | null) => {
  const value = n(v);
  return value == null || !Number.isFinite(value) ? "未検証" : `${value > 0 ? "+" : ""}${value.toFixed(2)}%`;
};
export default function RepeatCandidateRiskPage() {
  const [data, setData] = useState<Response | null>(null);
  const [error, setError] = useState("");
  const [onlyDrop, setOnlyDrop] = useState(true);
  const [loading, setLoading] = useState(true);
  const [showPendingOnly, setShowPendingOnly] = useState(false);
  const [reloadCount, setReloadCount] = useState(0);
  useEffect(() => {
    let active = true;
    fetch("/api/admin/repeat-candidate-risk", { cache: "no-store" })
      .then(async r => {
        const result = await r.json() as Response;
        if (!r.ok || !result.success) throw new Error(result.error || "取得失敗");
        if (active) { setData(result); setError(""); }
      }).catch(e => { if (active) { setData(null); setError(e instanceof Error ? e.message : "取得失敗"); } })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [reloadCount]);
  const verifiedRows = useMemo(() => excludeUnverifiedDatedOutcomes(data?.rows || []), [data]);
  const summary = useMemo(() => {
    const all = verifiedRows;
    const groups = [
      { label: "前回比5%超下落", rows: all.filter(r => r.previous_candidate_drop_over_5pct) },
      { label: "その他の再選出", rows: all.filter(r => !r.previous_candidate_drop_over_5pct) },
    ];
    return groups.map(g => {
      return { label: g.label, ...summarizeGroup(g.rows) };
    });
  }, [verifiedRows]);
  const overallCoverage = useMemo(() => assessedOutcomeCoverage(verifiedRows), [verifiedRows]);
  const thresholds = useMemo(() => thresholdSensitivity(verifiedRows), [verifiedRows]);
  const dateAudit = useMemo(() => outcomeDateIntegrity(data?.rows || []), [data]);
  const calendarAudit = useMemo(() => outcomeCalendarAudit(data?.rows || []), [data]);
  const weekdayAudit = useMemo(() => weekdayGapAudit(data?.rows || []), [data]);
  const matched = useMemo(() => sameDayComparison(verifiedRows), [verifiedRows]);
  const sameDay = matched.days;
  const sensitivity = useMemo(() => matchedDaySensitivity(verifiedRows), [verifiedRows]);
  const concentration = useMemo(() => {
    const eligible = verifiedRows.filter(r =>
      r.previous_candidate_drop_over_5pct && n(r.return_5d) != null);
    const dates = new Map<string, number>();
    const codes = new Map<string, number>();
    for (const row of eligible) {
      dates.set(row.trade_date, (dates.get(row.trade_date) ?? 0) + 1);
      codes.set(row.code, (codes.get(row.code) ?? 0) + 1);
    }
    const sorted = [...dates.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
    const excluded = withoutLargestDay(eligible);
    return {
      observations: eligible.length,
      distinctDates: dates.size,
      distinctStocks: codes.size,
      topDate: sorted[0]?.[0] ?? null,
      topDateCount: sorted[0]?.[1] ?? 0,
      remainingCount: excluded.checked,
      remainingDays: excluded.days,
      remainingAverage: excluded.average,
      repeatedStocks: [...codes.values()].filter(count => count > 1).length,
    };
  }, [verifiedRows]);
  const pendingByDate = useMemo(() => outcomeCoverageByDate(verifiedRows.filter(r => r.previous_candidate_drop_over_5pct)), [verifiedRows]);
  const rows = useMemo(() => verifiedRows.filter(r =>
    (!onlyDrop || r.previous_candidate_drop_over_5pct) &&
    (!showPendingOnly || n(r.return_5d) == null)), [verifiedRows, onlyDrop, showPendingOnly]);
  return <main className="min-h-screen bg-slate-50 px-4 py-6 text-slate-900">
    <div className="mx-auto max-w-3xl space-y-4 rounded-2xl bg-white p-4">
      <a href="/admin/learning-hub" className="text-sm text-blue-700">← 学習管理へ</a>
      <h1 className="text-xl font-black">高POWER再選出・下落リスク｜研究専用</h1>
      <p className="text-sm text-slate-600">AI POWER90以上を対象に、前回CANDIDATE時の保存価格と、再選出時点の保存価格を比較します。AI POWERのみの簡易研究判定で、投資判断や通知には反映されません。</p>
      <div className="flex flex-wrap items-center gap-3 text-xs"><button type="button" disabled={loading} onClick={() => { setData(null); setError(""); setLoading(true); setReloadCount(n => n + 1); }} className="rounded-lg border px-3 py-2 disabled:opacity-50">保存結果を再取得</button><span>取得時刻：{data?.fetchedAt ? new Date(data.fetchedAt).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" }) + " JST" : "未取得"}</span></div>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={onlyDrop} onChange={e => setOnlyDrop(e.target.checked)} /> 前回候補比で5%超下落した銘柄のみ</label>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={showPendingOnly} onChange={e => setShowPendingOnly(e.target.checked)} /> 5日後結果が未確定の記録のみ</label>
      {error && <p role="alert" className="text-rose-700">再取得に失敗しました。古い集計を最新結果として表示しないため、表示をクリアしました：{error}</p>}
      {loading && <p role="status">研究データを取得中…</p>}
      {data && <><section aria-label="5日後結果の日付整合性" className="rounded-xl border p-3"><h2 className="font-bold">5日後結果の日付整合性（研究監査）</h2><p className="text-sm">結果あり・日付なし {dateAudit.returnWithoutDate}件 ／ 日付あり・結果なし {dateAudit.dateWithoutReturn}件 ／ 判定日より前の結果日 {dateAudit.outcomeBeforeTrade}件 ／ 存在しない結果日 {calendarAudit.invalidCalendarDate}件 ／ 同日の5日後結果 {calendarAudit.sameDayOutcome}件 ／ 土日だけを除いた5日間と一致しない結果 {weekdayAudit.weekdayMismatch}件</p><p className="text-xs text-slate-600">土日を除いた簡易検査であり、日本の祝日・取引所休場日は未照合です。不一致は即座に誤データと断定せず、追加調査対象として扱います。</p>{(dateAudit.suspectCount > 0 || calendarAudit.invalidCalendarDate > 0 || calendarAudit.sameDayOutcome > 0) && <p role="alert" className="text-sm text-rose-700">日付と結果に不整合があるため、成績の独立検証が必要です。保存データは変更しません。</p>}</section><section aria-label="研究採用の暫定判定" className="rounded-xl border border-amber-300 bg-amber-50 p-3"><h2 className="text-base font-black">研究段階：本番判定への採用は保留</h2><p className="mt-1 text-sm">同日比較できた取引日は {matched.matchedDayCount}日、5%超下落群の評価済み取引日は {summary[0]?.days ?? 0}日です。全再選出の5日後評価完了率は {overallCoverage.completionRate == null ? "未検証" : `${overallCoverage.completionRate.toFixed(1)}%`}（評価済 {overallCoverage.checked}件／未確定 {overallCoverage.pending}件）。</p><p className="mt-1 text-xs">参考確認項目：比較可能日3日以上・下落群の評価済み日3日以上・取得件数の打ち切りなし。これは実証済みの採用基準ではなく、少数日を見落とさないための暫定的な注意表示です。</p>{(matched.matchedDayCount < 3 || (summary[0]?.days ?? 0) < 3 || data.truncated) && <p className="mt-1 text-xs font-bold text-rose-800">サンプルまたは取得範囲が不足。将来の再現性・独立した価格検証が終わるまで、AI売買判定や通知には反映しません。</p>}</section>{data.truncated && <p role="alert" className="text-sm font-bold text-rose-700">取得上限1000件に達したため、下記の統計は全期間集計ではありません。</p>}<section aria-label="同日比較ではない参考集計" className="grid grid-cols-2 gap-2">
        {summary.map(g => <div key={g.label} className="rounded-xl border bg-slate-50 p-3">
          <p className="text-xs font-bold">{g.label}</p><p className="mt-1 text-lg font-black">{pct(g.average)}</p>
          <p className="text-xs text-slate-600">銘柄件数で重み付けした5日後平均</p><p className="mt-1 text-xs">中央値：{pct(g.median)} ／ プラス率：{pct(g.positiveRate)}</p><p className="mt-2 text-sm font-bold">日付均等平均：{pct(g.dateBalancedAverage)}</p><p className="text-xs text-slate-600">記録 {g.count}件 ／ 評価済 {g.checked}件 ／ 評価日数 {g.days}日</p>
        </div>)}
      </section><section className="rounded-xl border p-3">
        <h2 className="text-base font-black">下落率の閾値別感度（参考）</h2>
        <p className="text-xs text-slate-600">前回候補からの下落が3%、5%、7%を超えた群を比較。群は重複しており、投資シグナルの優劣や因果関係を示しません。</p>
        <div className="mt-2 overflow-x-auto"><table className="w-full text-left text-xs"><thead><tr className="border-b"><th className="p-2">下落率</th><th className="p-2">対象</th><th className="p-2">評価済</th><th className="p-2">未確定</th><th className="p-2">評価日</th><th className="p-2">日付均等平均</th></tr></thead>
        <tbody>{thresholds.map(t => <tr key={t.drop} className="border-b"><td className="p-2">{t.drop}%超</td><td className="p-2">{t.count}</td><td className="p-2">{t.checked}</td><td className="p-2">{t.pending}</td><td className="p-2">{t.days}日</td><td className="p-2">{pct(t.dateBalancedAverage)}</td></tr>)}</tbody></table></div>
        <p className="mt-1 text-xs text-amber-800">閾値を後から選ぶと過剰適合につながります。独立した将来データでの再現性確認が必要です。</p>
      </section><section className="rounded-xl border p-3">
        <h2 className="text-base font-black">同じ判定日の5日後結果を比較</h2>
        <p className="mt-1 text-xs text-slate-600">両グループに評価済みデータがある日だけ表示。対象は再選出・POWER90以上で、同日でも業種や銘柄構成の差は残ります。</p>
        <p className="mt-2 text-sm font-bold">同日差の日付均等平均：{matched.dateBalancedGap == null ? "未検証" : `${matched.dateBalancedGap > 0 ? "+" : ""}${matched.dateBalancedGap.toFixed(2)}pt`}（比較可能 {matched.matchedDayCount}日）</p>
        {matched.matchedDayCount < 3 && <p className="text-xs text-rose-800">比較可能な取引日が3日未満です。同日比較でも再現性は未確認です。</p>}
        <div className="mt-2 overflow-x-auto"><table className="w-full min-w-[540px] text-left text-xs">
          <thead><tr className="border-b"><th className="p-2">判定日</th><th className="p-2">5%超下落群</th><th className="p-2">その他</th><th className="p-2">平均との差</th></tr></thead>
          <tbody>{sameDay.map(day => <tr key={day.date} className="border-b">
            <td className="p-2">{day.date}</td>
            <td className="p-2">{pct(day.riskMean)}（{day.riskCount}件）</td>
            <td className="p-2">{pct(day.otherMean)}（{day.otherCount}件）</td>
            <td className="p-2">{day.gap > 0 ? "+" : ""}{day.gap.toFixed(2)}pt</td>
          </tr>)}</tbody>
        </table></div>
        {sameDay.length === 0 && <p className="mt-2 text-sm text-slate-500">同一日に両群の結果が揃った記録はまだありません。</p>}
        {sameDay.length > 0 && <p className="mt-2 text-xs text-slate-700">比較可能な日を1日ずつ除外した平均との差：{sensitivity.minimum == null ? "未検証" : `${sensitivity.minimum.toFixed(2)}〜${sensitivity.maximum?.toFixed(2)}pt`}（残る判定日 {Math.max(0, matched.matchedDayCount - 1)}日）。少数日の場合、頑健性の証明にはなりません。</p>}
        <p className="mt-2 text-xs text-amber-800">記録件数が少ない日や市場急変時に偏り得ます。独立した終値検証・将来の再現性は未確認です。</p>
      </section><section className="rounded-xl border p-3">
        <h2 className="text-base font-black">5日後結果の確定状況（5%超下落群）</h2>
        <p className="mt-1 text-xs text-slate-600">未確定はゼロ損益ではありません。結果日が欠落・不正な評価値も研究統計から除外します。</p>
        <div className="mt-2 overflow-x-auto"><table className="w-full text-left text-xs">
          <thead><tr className="border-b"><th className="p-2">判定日</th><th className="p-2">対象</th><th className="p-2">評価済</th><th className="p-2">未確定</th><th className="p-2">完了率</th></tr></thead>
          <tbody>{pendingByDate.map(day => <tr key={day.date} className="border-b">
            <td className="p-2">{day.date}</td><td className="p-2">{day.total}</td>
            <td className="p-2">{day.completed}</td><td className="p-2">{day.pending}</td><td className="p-2">{day.completionRate.toFixed(0)}%</td>
          </tr>)}</tbody>
        </table></div>
      </section><section className="rounded-xl border p-3">
        <h2 className="text-base font-black">日付・銘柄の集中度（5%超下落群）</h2>
        <p className="mt-2 text-sm">5日後評価済 {concentration.observations}件 ／ 判定日 {concentration.distinctDates}日 ／ 銘柄数 {concentration.distinctStocks}</p>
        <p className="mt-1 text-sm">最多判定日 {concentration.topDate ?? "未検証"}：{concentration.topDateCount}件
          {concentration.observations > 0 ? `（全体の${(100 * concentration.topDateCount / concentration.observations).toFixed(1)}%）` : ""}</p>
        <p className="mt-1 text-sm">複数回登場した銘柄 {concentration.repeatedStocks}銘柄</p>
        <p className="mt-2 text-sm font-semibold">最多判定日を除外：残り {concentration.remainingCount}件 ／ {concentration.remainingDays}日 ／ 5日後平均 {pct(concentration.remainingAverage)}</p>
        {concentration.remainingDays < 3 && <p className="text-xs text-rose-800">除外後の評価日数が3日未満のため、再現性評価には不足しています。</p>}
        <p className="mt-2 text-xs text-amber-800">件数は独立した試行回数ではありません。同日・同業種・同銘柄への偏りがあり、再現性の根拠にはできません。</p>
      </section><p className="text-xs text-amber-800">※ 件数平均と日付均等平均は別指標。日付均等平均は各取引日の平均を1票ずつ扱いますが、業種・POWERの偏りや少数日問題は解消しません。上の2群は将来の予測能力や除外効果を示しません。</p><p className="text-sm">表示 {rows.length}件（一覧の絞り込みのみ。上の統計は全取得データ）／ 取得 {data.rows?.length ?? 0}件{data.truncated ? "（直近1000件のみ・全期間の集計ではありません）" : ""}</p>
        <div className="overflow-x-auto"><table className="w-full min-w-[650px] border-collapse text-left text-xs">
          <thead><tr className="border-b bg-slate-100"><th className="p-2">日付・銘柄</th><th className="p-2">前回候補</th><th className="p-2">前回比</th><th className="p-2">AI POWER</th><th className="p-2">5日後</th><th className="p-2">結果日</th></tr></thead>
          <tbody>{rows.map(r => <tr key={r.trade_date + ":" + r.code} className="border-b">
            <td className="p-2">{r.trade_date}<div className="font-bold">{r.code} {r.name}</div></td>
            <td className="p-2">{r.previous_candidate_date}</td>
            <td className="p-2 font-semibold">{pct(r.previous_candidate_change_pct)}</td>
            <td className="p-2">{n(r.ai_power)?.toFixed(1) ?? "不明"}</td>
            <td className="p-2">{pct(r.return_5d)}{n(r.return_5d) == null && (data?.rows || []).some(original => original.trade_date === r.trade_date && original.code === r.code && n(original.return_5d) != null) ? "（日付不整合で除外）" : ""}</td>
            <td className="p-2">{r.outcome_5d_date || "未確定"}</td>
          </tr>)}</tbody>
        </table></div>
        {rows.length === 0 && <p className="text-sm">該当記録はありません。</p>}
        <p className="text-xs text-amber-800">{data.note}</p>
        <p className="text-xs text-slate-500">価格の取得元・足の確定時刻・独立した終値照合は、この表示だけでは証明されません。将来の勝率や売買可能な価格を示すものではありません。</p>
      </>}
    </div>
  </main>;
}
