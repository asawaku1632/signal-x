"use client";

import { useEffect, useState } from "react";

type Historical = {
  observed: number;
  completed5: number;
  settledDays: number;
  latestSignalDate: string | null;
  meanReturn5: number | null;
  riseRate5: number | null;
};
type Signal = {
  key: string;
  title: string;
  status: "RESEARCH_ONLY";
  deliveryEnabled: false;
  dataConnection: "RELATED_HISTORICAL_AGGREGATE_ONLY" | "NOT_YET_MAPPED";
  historical: Historical | null;
  reasons: string[];
};
type Response = { success: boolean; checkedAt?: string; signals?: Signal[]; error?: string };

export default function FiveSignalResearchPreview() {
  const [result, setResult] = useState<Response | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/push/five-signal-preview", {
      signal: controller.signal,
      cache: "no-store",
      credentials: "same-origin",
    })
      .then(async (response) => {
        if (!response.ok) throw new Error(response.status === 404 ? "管理者専用ページです" : "研究データを取得できません");
        return response.json() as Promise<Response>;
      })
      .then((data) => setResult(data))
      .catch((error: unknown) => {
        if (!controller.signal.aborted) setResult({ success: false, error: error instanceof Error ? error.message : "取得に失敗しました" });
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, []);

  return (
    <main className="mx-auto max-w-3xl space-y-5 px-4 py-8">
      <h1 className="text-2xl font-bold">5種類の通知｜研究確認</h1>
      <p className="text-sm">管理者専用・読み取り専用。通知送信や売買注文は行いません。</p>
      {loading && <p role="status">研究データを確認中…</p>}
      {!loading && (!result?.success || !result.signals) && (
        <p role="alert">{result?.error ?? "研究データを表示できません"}</p>
      )}
      {result?.success && result.signals && (
        <>
          <p className="text-xs">確認日時：{result.checkedAt ?? "不明"} / 通知：未解禁</p>
          <div className="space-y-4">
            {result.signals.map((signal) => (
              <section key={signal.key} className="rounded-xl border p-4">
                <h2 className="text-lg font-semibold">{signal.title}</h2>
                <p className="text-sm">研究段階・通知送信なし</p>
                <p className="text-sm">データ：{signal.dataConnection === "NOT_YET_MAPPED" ? "独立したデータ接続は未実装" : "関連する過去研究の集計のみ"}</p>
                {signal.historical && (
                  <p className="text-sm">過去観測 {signal.historical.observed}件 / 5日後検証 {signal.historical.completed5}件 / 検証日 {signal.historical.settledDays}日</p>
                )}
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
                  {signal.reasons.map((reason, index) => <li key={index}>{reason}</li>)}
                </ul>
              </section>
            ))}
          </div>
        </>
      )}
    </main>
  );
}
