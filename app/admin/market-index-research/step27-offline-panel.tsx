"use client";

import { useState } from "react";
// @ts-expect-error Research-only JavaScript module is covered by node:test.
import { evaluateN225Chart } from "../../lib/research/step27-n225-offline-evaluator.mjs";

type Scenario = "fresh" | "stale" | "invalid";
const checkedAt = new Date("2026-10-27T01:00:00Z"); // Fixed simulated time: 10:00 JST.
const scenarios: Record<Scenario, { label: string; minutesAgo: number; close: number | null }> = {
  fresh: { label: "正常な1分前のデータ", minutesAgo: 1, close: 50000 },
  stale: { label: "21分前の古いデータ", minutesAgo: 21, close: 50000 },
  invalid: { label: "最新終値が欠損", minutesAgo: 1, close: null },
};
export default function Step27OfflinePanel() {
  const [scenario, setScenario] = useState<Scenario>("fresh");
  const example = scenarios[scenario];
  const timestamp = Math.floor(checkedAt.getTime() / 1000) - example.minutesAgo * 60;
  const result = evaluateN225Chart({
    chart: { result: [{
      meta: { symbol: "^N225" }, timestamp: [timestamp],
      indicators: { quote: [{ close: [example.close] }] },
    }] },
  }, checkedAt) as { status: string; reason: string; ageMinutes?: number };
  return (
    <section aria-labelledby="step27-heading" className="rounded-2xl border bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
      <h2 id="step27-heading" className="font-black">🧪 STEP27｜鮮度判定のオフライン実行</h2>
      <p className="mt-2 text-sm">実際の判定関数を固定の模擬入力で実行しています。実市場データ、株価取得結果、運用実績ではありません。</p>
      <label htmlFor="step27-scenario" className="mt-3 block text-sm font-bold">模擬ケースを選択</label>
      <select id="step27-scenario" value={scenario} onChange={e => setScenario(e.target.value as Scenario)} className="mt-1 w-full rounded-lg border border-slate-400 bg-white p-2 text-slate-900">
        {Object.entries(scenarios).map(([key, value]) => <option key={key} value={key}>{value.label}</option>)}
      </select>
      <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
        <div><dt>判定（模擬）</dt><dd className="font-bold">{result.status}</dd></div>
        <div><dt>理由</dt><dd className="break-all font-mono">{result.reason}</dd></div>
        <div><dt>経過時間（模擬）</dt><dd>{result.ageMinutes ?? "判定対象外"}分</dd></div>
        <div><dt>実データ取得</dt><dd>未実施</dd></div>
      </dl>
      <p className="mt-3 text-xs text-slate-500">外部通信なし／DB書き込みなし／Cronなし／本番判定・通知・売買への接続なし</p>
    </section>
  );
}
