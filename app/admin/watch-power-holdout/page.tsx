import Link from "next/link";
import { notFound } from "next/navigation";
import pool from "@/app/lib/postgres";
import { getLearningOwnerSession } from "@/app/lib/learningOwner";
import { mapFrozenSwingRows, type FrozenSwingRow } from "@/app/lib/learning/watchPowerHoldoutAdapter";
import { getWatchPowerHoldoutReadiness } from "@/app/lib/learning/watchPowerHoldoutReadiness";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

export default async function WatchPowerHoldoutPage() {
  const { isOwner } = await getLearningOwnerSession();
  if (!isOwner) notFound();

  let error = false;
  let truncated = false;
  let report: ReturnType<typeof getWatchPowerHoldoutReadiness> | null = null;
  try {
    // Hard limit prevents accidentally presenting an incomplete cohort as complete.
    const result = await pool.query<FrozenSwingRow>(
      "SELECT code, trade_date::text AS trade_date, decision_status, " +
      "ai_power, return_5d FROM public.swing_universe_observations " +
      "WHERE trade_date > $1::date AND decision_status = $2 " +
      "ORDER BY trade_date, code LIMIT 20001",
      ["2026-10-24", "WATCH"],
    );
    truncated = result.rows.length > 20000;
    if (!truncated) {
      report = getWatchPowerHoldoutReadiness(mapFrozenSwingRows(result.rows));
    }
  } catch (cause) {
    console.error("WATCH holdout read-only report unavailable", cause);
    error = true;
  }

  const status = error || truncated || !report ? "確認不可" :
    report.status === "DATA_CONFLICT" ? "データ矛盾あり" :
    report.status === "REVIEW_READY" ? "研究レビュー可能" : "データ収集中";

  return <main className="min-h-screen bg-slate-50 px-3 py-5 text-slate-900">
    <div className="mx-auto max-w-3xl space-y-4">
      <Link href="/admin/learning-hub" className="text-sm font-bold text-blue-700">
        ← 学習管理室へ戻る
      </Link>
      <header className="rounded-2xl border border-indigo-200 bg-white p-5">
        <p className="text-xs font-black tracking-wider text-indigo-700">OWNER PRIVATE / RESEARCH ONLY</p>
        <h1 className="mt-2 text-2xl font-black">🔬 様子見 × AI POWER 未来検証</h1>
        <p className="mt-3 text-sm leading-6">2026年10月26日以降に記録した「様子見」銘柄だけを対象に、5営業日後の結果を研究します。低評価帯（68未満）と高評価帯（71以上）を日付ごとに比較します。</p>
      </header>
      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="text-lg font-black">現在の研究状態：{status}</h2>
        {error || truncated || !report ?
          <p className="mt-3 text-sm text-rose-700">研究データを安全に確認できません。{truncated ? "取得上限に達したため集計を停止しました。" : "読み取りに失敗したため集計を停止しました。"} 不完全な数値は表示しません。</p> :
          <div className="mt-3 space-y-2 text-sm">
            <p>保存された判定日：{report.observedDates}日</p>
            <p>比較が成立した日：{report.comparableDates}日</p>
            <p>レビュー開始まで残り：{report.remainingComparableDates}日</p>
            <p>5日後の結果が未確定のある日：{report.datesWithMissingOutcomes}日</p>
            <p>低・高の両方を比較できない日：{report.datesWithoutBothGroups}日</p>
            <p>矛盾した重複：{report.conflictingDuplicates}件</p>
            {report.reviewReady && report.dateEqualWeightDifferencePp !== null ?
              <p className="font-bold">日付均等平均の差：{report.dateEqualWeightDifferencePp.toFixed(2)}ポイント（研究参考値）</p> :
              <p className="text-amber-800">比較条件が整うまで、平均騰落率の差は表示しません。</p>}
          </div>}
      </section>
      <p className="text-xs leading-5 text-slate-600">保存済みデータの読み取り専用。研究レビュー可能は利益や予測精度の保証ではありません。売買判定・通知・自動取引には接続していません。</p>
    </div>
  </main>;
}
