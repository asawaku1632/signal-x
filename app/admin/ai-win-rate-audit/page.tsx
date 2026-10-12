"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { AuditHistoryEntry, WeeklyAuditSummary } from "@/app/lib/learning/winRateWeeklyAudit";

type Audit = {
  success: true;
  asOf: string;
  dailyReliability: {
    scheduleJst: string;
    latest: AuditHistoryEntry | null;
    recent: AuditHistoryEntry[];
    weekly: WeeklyAuditSummary[];
  };
  reported: { wins: number; losses: number; winRate: number | null };
  historicalUntraced: { tradeDate: string; count: number; wins: number; losses: number; status: string };
  sensitivity: { excludingHistoricalUntraced: number | null; note: string };
  batches: Array<{ group_key: string; total: number; win: number; lose: number; hold: number }>;
  newProvenance: { count: number; latestAt: string | null; scope: string };
};

const WARNING_LABELS: Record<string, string> = {
  TODAY_SNAPSHOT_MISSING: "当日の株価保存が未確認",
  DAILY_LEARNING_UNCONFIRMED: "当日の自動学習完了が未確認",
  INVALID_SAVED_PRICE: "保存株価に欠損・0以下の値あり",
  PRICE_PROVENANCE_MISMATCH: "価格の出典記録と保存結果に不一致あり",
  RECENT_RESULTS_WITHOUT_PROVENANCE: "直近36時間の確定結果に出典未記録あり",
  PRICE_PROVENANCE_NOT_STARTED: "新方式の価格出典記録はまだ0件（新規判定がない場合もあります）",
};

function auditStatusLabel(status: "OK" | "NEEDS_REVIEW" | "ERROR" | "PENDING") {
  return status === "OK" ? "検査範囲内で問題検出なし" :
    status === "ERROR" ? "監査失敗" :
    status === "PENDING" ? "監査待ち" : "要確認";
}

export default function AiWinRateAuditPage() {
  const [audit, setAudit] = useState<Audit | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    fetch("/api/admin/ai-win-rate-audit", { cache: "no-store" })
      .then(async (r) => {
        const result = await r.json();
        if (!r.ok) throw new Error(r.status === 403 ? "管理者としてログインしてください" : result.error ?? "取得失敗");
        setAudit(result);
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : "取得失敗"));
  }, []);

  return (
    <main className="min-h-screen bg-slate-50 px-3 py-3 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <div className="mx-auto max-w-3xl">
        <Link href="/admin/learning-status" className="text-xs font-bold text-blue-600">← AI学習管理へ</Link>
        <h1 className="mt-2 text-xl font-black sm:text-2xl">AI勝率の信頼性監査</h1>
        <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-300">
          管理者専用・読み取りのみ。過去データと現在の集計を分けて確認します。
        </p>
        {error && <p className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        {!audit && !error && <p className="mt-3 text-sm">監査データを読み込み中…</p>}
        {audit && (
          <>
            <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
              集計時点：{new Date(audit.asOf).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" })}
            </p>
            <section className="mt-3 rounded-2xl border border-blue-200 bg-white p-3 dark:border-blue-800 dark:bg-slate-900">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-base font-black">🛡️ 毎営業日の自動監査</h2>
                <span className="rounded-lg bg-blue-50 px-2 py-1 text-[11px] font-bold text-blue-700">18:15 JST</span>
              </div>
              <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-300">
                株価・取得元の整合性と学習完了を保存。売買判定は変更しません。
              </p>
              {audit.dailyReliability.latest ? (
                <div className="mt-3 rounded-xl bg-slate-50 p-3 dark:bg-slate-800">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-sm font-black">最終監査：{audit.dailyReliability.latest.tradeDate}</span>
                    <span className="text-xs font-black">{auditStatusLabel(audit.dailyReliability.latest.status)}</span>
                  </div>
                  {audit.dailyReliability.latest.audit && (
                    <>
                      <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                        <span>当日の株価保存：<b>{audit.dailyReliability.latest.audit.snapshotCount.toLocaleString()}件</b></span>
                        <span>出典記録累計：<b>{audit.dailyReliability.latest.audit.provenanceCount.toLocaleString()}件</b></span>
                        <span>出典との不一致：<b>{audit.dailyReliability.latest.audit.mismatchedProvenanceCount}件</b></span>
                        <span>最近の出典未記録：<b>{audit.dailyReliability.latest.audit.recentUntracedCount}件</b></span>
                      </div>
                      {audit.dailyReliability.latest.audit.warnings.length > 0 && (
                        <div className="mt-2 space-y-1 text-xs text-amber-800 dark:text-amber-300">
                          {audit.dailyReliability.latest.audit.warnings.map((warning) => (
                            <p key={warning}>⚠ {WARNING_LABELS[warning] ?? warning}</p>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                  {audit.dailyReliability.latest.status === "ERROR" && (
                    <p className="mt-2 text-xs font-bold text-red-700 dark:text-red-300">
                      監査処理に失敗しました。数値を正常とみなさず実行ログを確認してください。
                    </p>
                  )}
                </div>
              ) : (
                <p className="mt-3 rounded-xl bg-slate-50 p-3 text-sm font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-200">
                  自動監査はまだ未実行です。次の東証営業日18:15以降に結果が表示されます。
                </p>
              )}

              <h3 className="mt-4 text-sm font-black">📅 週次監査レポート（保存結果から自動集計）</h3>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {audit.dailyReliability.weekly.slice(0, 2).map((week, index) => (
                  <div key={week.weekStart} className="min-w-0 rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800">
                    <p className="text-xs font-black">{index === 0 ? "今週" : "先週"}</p>
                    <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-300">{week.weekStart.slice(5).replace("-", "/")}〜{week.weekEnd.slice(5).replace("-", "/")}</p>
                    <p className="mt-1 text-lg font-black">{week.auditedDays}/{week.scheduledDays}日</p>
                    <p className="mt-1 text-xs font-bold">{auditStatusLabel(week.status)}</p>
                    <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-300">
                      確認 {week.reviewDays + week.errorDays}日・未実施 {week.missingDays}日
                    </p>
                  </div>
                ))}
              </div>
              <p className="mt-2 text-[11px] leading-5 text-slate-500 dark:text-slate-300">
                監査記録のある日のみ集計。未実施日は正常扱いしません。累計勝率は精度の保証ではありません。
              </p>
              <details className="mt-3 rounded-xl border border-slate-200 dark:border-slate-700">
                <summary className="cursor-pointer p-3 text-xs font-black">過去の監査記録・週次内訳を見る ▼</summary>
                <div className="space-y-2 border-t border-slate-200 p-3 text-xs dark:border-slate-700">
                  {audit.dailyReliability.weekly.map((week) => (
                    <div key={week.weekStart} className="rounded-lg bg-slate-50 p-2 dark:bg-slate-800">
                      <b>{week.weekStart}〜{week.weekEnd}</b>
                      <p className="mt-1">対象 {week.scheduledDays}日 ／ 監査済 {week.auditedDays}日 ／ 問題検出なし {week.okDays}日 ／ 要確認 {week.reviewDays}日 ／ 失敗 {week.errorDays}日 ／ 未実施 {week.missingDays}日</p>
                    </div>
                  ))}
                  {audit.dailyReliability.recent.map((day) => (
                    <div key={day.tradeDate} className="flex items-center justify-between gap-2 border-t border-slate-100 pt-2 dark:border-slate-700">
                      <span className="font-bold">{day.tradeDate}</span>
                      <span>{auditStatusLabel(day.status)}{day.audit ? " ｜ 株価保存 " + day.audit.snapshotCount + "件" : ""}</span>
                    </div>
                  ))}
                  {audit.dailyReliability.recent.length === 0 && <p>日次監査の記録はまだありません。</p>}
                </div>
              </details>
            </section>

            <section className="mt-2 grid grid-cols-2 gap-2">
              <Metric label="累計勝率" value={audit.reported.winRate === null ? "--" : audit.reported.winRate + "%"} />
              <Metric label="未追跡群除外（参考）" value={audit.sensitivity.excludingHistoricalUntraced === null ? "--" : audit.sensitivity.excludingHistoricalUntraced + "%"} />
              <Metric label={"過去の未追跡（" + audit.historicalUntraced.tradeDate.slice(5).replace("-", "/") + "）"} value={audit.historicalUntraced.count + "件"} />
              <Metric label="新しい株価追跡記録" value={audit.newProvenance.count + "件"} />
            </section>
            <p className="mt-2 text-xs leading-5 text-amber-700 dark:text-amber-300">{audit.sensitivity.note}</p>
            <details className="group mt-3 rounded-2xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-2 p-3">
                <span className="text-sm font-black">📋 過去データの監査（{audit.historicalUntraced.tradeDate}）</span>
                <span className="text-xs text-blue-600">詳細 <span className="inline-block transition group-open:rotate-180">▼</span></span>
              </summary>
              <div className="border-t border-slate-100 p-3 dark:border-slate-700">
                <p className="text-xs leading-5 text-slate-600 dark:text-slate-300">
                  この日付は過去の特別な監査対象日で、最新の学習日ではありません。
                  当時の保存株価と一致した20件とは別に、価格取得元を記録していなかったデータがあります。
                  取得元不明を誤判定とみなすことはできません。
                </p>
                <div className="mt-3 space-y-2">
                  {audit.batches.map((batch) => (
                    <div key={batch.group_key} className="rounded-lg bg-slate-100 p-3 text-xs dark:bg-slate-800">
                      <p className="font-black">
                        {batch.group_key === "snapshot_match_batch" ? "保存株価と一致した群" : batch.group_key === "untraced_legacy_batch" ? "取得元が未追跡の群" : "その他"}
                      </p>
                      <p className="mt-1">{batch.total}件 ｜ {batch.win}勝 {batch.lose}敗 {batch.hold}HOLD</p>
                    </div>
                  ))}
                </div>
              </div>
            </details>
            <p className="mt-3 text-xs leading-5 text-slate-500 dark:text-slate-400">
              新規の追跡記録は別保存し、過去の結果を後から「証明済み」には変更しません。
              追跡0件の場合は保存状況の確認が必要です。
            </p>
          </>
        )}
      </div>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
      <p className="text-xs font-bold text-slate-500 dark:text-slate-300">{label}</p>
      <p className="mt-1 break-words text-xl font-black sm:text-2xl">{value}</p>
    </div>
  );
}
