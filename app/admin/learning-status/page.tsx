"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type SaveLog = {
  status: string;
  message: string | null;
  httpStatus: number | null;
  details: Record<string, unknown> | null;
  createdAt: string | null;
};

type LearningStatus = {
  success: true;
  checkedAt: string;
  today: string;
  isBusinessDay: boolean;
  latestSavedDate: string | null;
  latestConfirmedDate: string | null;
  savedToday: boolean;
  savedCount: number;
  judgedCount: number;
  unknownCount: number;
  latestCron: SaveLog | null;
  lastError: SaveLog | null;
  health: "ok" | "error";
  alerts: string[];
};

function formatDateTime(value: string | null) {
  if (!value) return "記録なし";
  return new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date(value));
}

export default function LearningStatusPage() {
  const [data, setData] = useState<LearningStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");
  const [runMessage, setRunMessage] = useState("");

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const response = await fetch("/api/admin/learning-status", {
        cache: "no-store",
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(
          response.status === 403
            ? "管理者としてログインしてください"
            : payload.error || "保存状況を取得できませんでした",
        );
      }

      setData(payload);
    } catch (loadError) {
      setData(null);
      setError(
        loadError instanceof Error
          ? loadError.message
          : "保存状況を取得できませんでした",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 初回表示時に管理APIから最新状態を取得するため。
    void load();
  }, [load]);

  async function runSaveApi() {
    if (!data?.isBusinessDay || running) return;

    try {
      setRunning(true);
      setRunMessage("保存APIを実行しています。完了までお待ちください。");
      const response = await fetch("/api/learning/save-daily", {
        cache: "no-store",
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.failureReason || "保存APIの実行に失敗しました");
      }

      setRunMessage(
        `保存完了：${payload.targetDate} / ${payload.savedCount}件追加 / ${payload.skippedCount}件スキップ`,
      );
      await load();
    } catch (runError) {
      setRunMessage(
        runError instanceof Error
          ? `実行失敗：${runError.message}`
          : "保存APIの実行に失敗しました",
      );
      await load();
    } finally {
      setRunning(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6 text-slate-950 dark:bg-slate-950 dark:text-slate-100">
      <div className="mx-auto max-w-5xl">
        <header className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <Link href="/" className="text-sm font-bold text-blue-600">
            ← SIGNALX Home
          </Link>
          <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-black tracking-[0.16em] text-blue-600">
                ADMIN MONITORING
              </p>
              <h1 className="mt-2 text-3xl font-black">AI学習保存状況</h1>
              <p className="mt-2 text-sm text-slate-500 dark:text-slate-300">
                日次スナップショットと自動保存Cronの状態を確認します
              </p>
            </div>
            {data && (
              <button
                type="button"
                onClick={() => void runSaveApi()}
                disabled={running || !data.isBusinessDay || data.savedToday}
                className="min-h-12 rounded-xl bg-blue-600 px-5 text-sm font-black text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300 dark:disabled:bg-slate-700"
              >
                {running
                  ? "保存API実行中..."
                  : data.savedToday
                    ? "本日保存済み"
                    : "保存API実行"}
              </button>
            )}
          </div>
        </header>

        {loading && (
          <div className="mt-5 rounded-3xl border border-slate-200 bg-white p-8 text-center font-bold text-slate-500 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
            保存状況を確認しています...
          </div>
        )}

        {!loading && error && (
          <div className="mt-5 rounded-3xl border border-red-200 bg-red-50 p-6 font-bold text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
            {error}
          </div>
        )}

        {data && (
          <>
            <section
              className={`mt-5 rounded-3xl border p-5 shadow-sm ${
                data.health === "error"
                  ? "border-red-300 bg-red-50 dark:border-red-800 dark:bg-red-950"
                  : "border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950"
              }`}
            >
              <p className="text-lg font-black">
                {data.health === "error" ? "⚠ 保存異常を検出" : "✓ 保存状態は正常です"}
              </p>
              {data.alerts.length > 0 && (
                <ul className="mt-3 space-y-1 text-sm font-bold text-red-700 dark:text-red-200">
                  {data.alerts.map((alert) => (
                    <li key={alert}>・{alert}</li>
                  ))}
                </ul>
              )}
              <p className="mt-3 text-xs text-slate-500 dark:text-slate-300">
                確認日時 {formatDateTime(data.checkedAt)}
              </p>
            </section>

            <section className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
              <Metric label="最新保存取引日" value={data.latestSavedDate ?? "なし"} danger={!data.savedToday && data.isBusinessDay} />
              <Metric label="最新完全判定日" value={data.latestConfirmedDate ?? "なし"} />
              <Metric label="本日保存済み" value={data.savedToday ? "はい" : "いいえ"} danger={!data.savedToday && data.isBusinessDay} />
              <Metric label="保存件数" value={`${data.savedCount.toLocaleString()}件`} danger={data.isBusinessDay && data.savedCount === 0} />
              <Metric label="判定件数" value={`${data.judgedCount.toLocaleString()}件`} />
              <Metric label="UNKNOWN件数" value={`${data.unknownCount.toLocaleString()}件`} />
              <Metric label="本日の区分" value={data.isBusinessDay ? "営業日" : "非営業日"} />
              <Metric label="Cron最終実行" value={formatDateTime(data.latestCron?.createdAt ?? null)} danger={data.latestCron?.status === "ERROR"} />
            </section>

            <section className="mt-5 grid gap-5 md:grid-cols-2">
              <LogCard title="Cron最終実行" log={data.latestCron} />
              <LogCard title="最後のエラー内容" log={data.lastError} error />
            </section>

            {runMessage && (
              <p className="mt-5 rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm font-bold text-blue-700 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-200">
                {runMessage}
              </p>
            )}
          </>
        )}
      </div>
    </main>
  );
}

function Metric({ label, value, danger = false }: { label: string; value: string; danger?: boolean }) {
  return (
    <div className={`min-w-0 rounded-2xl border bg-white p-4 shadow-sm dark:bg-slate-900 ${danger ? "border-red-300 dark:border-red-800" : "border-slate-200 dark:border-slate-700"}`}>
      <p className="text-xs font-bold text-slate-500 dark:text-slate-300">{label}</p>
      <p className={`mt-2 break-words text-lg font-black ${danger ? "text-red-600 dark:text-red-300" : "text-slate-950 dark:text-slate-100"}`}>{value}</p>
    </div>
  );
}

function LogCard({ title, log, error = false }: { title: string; log: SaveLog | null; error?: boolean }) {
  return (
    <article className={`rounded-3xl border bg-white p-5 shadow-sm dark:bg-slate-900 ${error && log ? "border-red-300 dark:border-red-800" : "border-slate-200 dark:border-slate-700"}`}>
      <h2 className="text-lg font-black">{title}</h2>
      {log ? (
        <div className="mt-3 space-y-2 text-sm text-slate-600 dark:text-slate-300">
          <p><span className="font-bold">状態：</span>{log.status}</p>
          <p><span className="font-bold">日時：</span>{formatDateTime(log.createdAt)}</p>
          <p className={error ? "font-bold text-red-600 dark:text-red-300" : ""}>{log.message ?? "詳細なし"}</p>
          {typeof log.details?.failureReason === "string" && <p className="break-words text-red-600 dark:text-red-300">{log.details.failureReason}</p>}
        </div>
      ) : (
        <p className="mt-3 text-sm text-slate-500 dark:text-slate-300">記録はありません</p>
      )}
    </article>
  );
}
