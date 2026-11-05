import Link from "next/link";
import { notFound } from "next/navigation";
import { getLearningOwnerSession } from "@/app/lib/learningOwner";
import { fetchCohort } from "@/app/lib/research/shadowCandleYahoo";
import {
  FOUR_PATTERN_LABELS, FOUR_PATTERN_VERSION, studyFourPatterns,
} from "@/app/lib/research/fourStrategyShadow.mjs";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Props = { searchParams: Promise<{ codes?: string }> };
const fmt = (value: number | null | undefined, suffix = "") =>
  value === null || value === undefined ? "未検証" : value.toFixed(2) + suffix;
const date = (t: number) => new Date(t * 1000).toLocaleDateString("ja-JP", { timeZone: "Asia/Tokyo" });

export default async function FourPatternsShadowPage({ searchParams }: Props) {
  const { isOwner } = await getLearningOwnerSession();
  if (!isOwner) notFound(); // Must precede all network requests.

  const params = await searchParams;
  const raw = typeof params.codes === "string" ? params.codes.slice(0, 80) : "";
  const attempted = raw.trim().length > 0;
  const codes = raw.trim().split(/[\s,、]+/).filter(Boolean);
  const error = attempted && (!codes.length || codes.length > 5 ||
    new Set(codes).size !== codes.length || codes.some(x => !/^[0-9]{4}$/.test(x)))
    ? "日本株4桁コードを重複なく1〜5件指定してください。" : null;
  // Daily historical data is fetched ONLY after owner auth and deliberate submit.
  const loaded = attempted && !error ? await fetchCohort(codes) : [];
  const reports = loaded.map(stock => ({
    code: stock.code, error: stock.error,
    report: stock.error ? null : studyFourPatterns({
      code: stock.code, timeframe: "1D", candles: stock.candles,
      // A quality-value signal must NOT be generated from absent fundamentals.
      fundamentals: [], source: "YAHOO_UNVERIFIED_COMPLETED_DAILY",
    }),
  }));
  const summaries = reports.flatMap(item =>
    item.report?.summaries.map(row => ({ code: item.code, ...row })) ?? []);
  const signals = reports.flatMap(item =>
    item.report?.rows ?? [])
    .sort((a, b) => b.signalTime - a.signalTime);

  return (
    <main className="min-h-screen bg-slate-50 px-3 py-5 pb-24 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <div className="mx-auto max-w-4xl space-y-4">
        <Link href="/admin/learning-hub" className="text-sm font-bold text-blue-700 dark:text-blue-300">
          ← 学習管理室へ戻る
        </Link>
        <header className="rounded-2xl bg-white p-4 dark:bg-slate-900">
          <p className="text-xs font-black text-indigo-600">OWNER PRIVATE / SHADOW ONLY</p>
          <h1 className="mt-1 text-2xl font-black">🔬 4手法まとめて比較</h1>
          <p className="mt-2 text-sm leading-6">水平線リテスト・EMA収縮・安値切り上げ・優良株押し目の独立した研究。確定済み日足で仮想100株の成績を比較します。</p>
          <p className="mt-2 text-xs text-slate-500">版 {FOUR_PATTERN_VERSION} ／ 売買注文・本番通知・AI POWER反映なし</p>
        </header>
        <section className="rounded-2xl border border-indigo-200 bg-indigo-50 p-4 text-sm leading-6 text-indigo-950 dark:border-indigo-900 dark:bg-slate-900 dark:text-indigo-200">
          <h2 className="font-black">📊 J-Quants 30分足・60分足の研究接続</h2>
          <p className="mt-1">過去の1分足と公式日足を照合して30分足・60分足へ集約する、ローカル研究ツールが利用可能です。決算の開示日時・前年同期との照合にも対応しました。</p>
          <p className="mt-1 font-bold">現状はPC内の専用コマンドだけで動作します。このWeb画面でJ-Quantsの分足や決算データを自動取得しているわけではありません。</p>
          <a href="https://github.com/asawaku1632/signal-x/blob/main/docs/four-pattern-jquants-bridge.md"
            target="_blank" rel="noopener noreferrer" className="mt-2 inline-block text-xs font-black underline">
            J-Quants研究の手順と安全上の制限を見る
          </a>
        </section>
        <section className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm leading-6 text-amber-950">
          <p className="font-black">研究結果は買い推奨でも利益予測でもありません。</p>
          <p className="mt-1">日足と過去データだけの事後検証です。当日の9:05判定ではありません。EMA収縮の30分・1時間足は、別途分足の確定データが必要です。この画面は日足だけを扱います。</p>
          <p className="mt-1">業績の公表日時付きデータを接続していないため、④は原則「未検証（0件）」です。0件を0%の勝率とは表示しません。取得元の権利・分割調整・実際の取得時刻は独立確認できていません。</p>
        </section>
        <form action="/admin/four-patterns-shadow" method="get"
          className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
          <label htmlFor="codes" className="text-sm font-bold">調べる銘柄（1〜5件、カンマ区切り）</label>
          <input id="codes" name="codes" defaultValue={raw} maxLength={80}
            placeholder="例：7203,6758,8306"
            className="mt-2 w-full rounded-xl border border-slate-300 bg-white p-3 text-base text-slate-900" />
          <button type="submit" className="mt-3 min-h-12 w-full rounded-xl bg-blue-700 px-4 text-sm font-black text-white">
            4手法を研究する
          </button>
          {error && <p role="alert" className="mt-2 text-sm font-bold text-red-600">{error}</p>}
          <p className="mt-2 text-xs text-slate-500">押した時のみ最大5銘柄の参考日足を取得。自動検索・定期処理・DB保存なし。</p>
        </form>
        {attempted && !error && (
          <section className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
            <h2 className="text-lg font-black">銘柄別・手法別の比較</h2>
            <p className="mt-1 text-xs text-slate-500">翌営業日寄り付き仮想買い、1・3・5営業日目の終値売り（各期間は別シミュレーション）。手数料・税別、片道滑り0.1%、100株・予算50万円以下だけを5日成績に集計。</p>
            {reports.filter(x => x.error || x.report?.status !== "OFFLINE_SHADOW_ONLY").map(item => (
              <p key={item.code} className="mt-2 rounded-lg bg-amber-50 p-3 text-xs text-amber-900">
                {item.code}：{item.error ?? item.report?.status ?? "DATA_UNAVAILABLE"}
              </p>
            ))}
            {summaries.length === 0 && <p className="mt-3 text-sm">検証できるデータがありません。</p>}
            <div className="mt-3 space-y-3">
              {summaries.map(item => (
                <div key={item.code + item.strategy}
                  className="rounded-xl border border-slate-200 p-3 dark:border-slate-700">
                  <h3 className="text-sm font-black">{item.code}｜{FOUR_PATTERN_LABELS[item.strategy as keyof typeof FOUR_PATTERN_LABELS]}</h3>
                  <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                    <div className="rounded-lg bg-slate-100 p-2 text-xs text-slate-900">
                      検出数<p className="mt-1 text-lg font-black">{item.signals}件</p>
                    </div>
                    <div className="rounded-lg bg-slate-100 p-2 text-xs text-slate-900">
                      5日後検証済み<p className="mt-1 text-lg font-black">{item.measured5}件</p>
                    </div>
                    <div className="rounded-lg bg-slate-100 p-2 text-xs text-slate-900">
                      5日後プラス率<p className="mt-1 text-lg font-black">{fmt(item.winRate5Percent, "%")}</p>
                    </div>
                    <div className="rounded-lg bg-slate-100 p-2 text-xs text-slate-900">
                      5日後平均損益<p className="mt-1 text-lg font-black">
                        {item.averageProfit5Yen100 === null ? "未検証" : item.averageProfit5Yen100.toLocaleString("ja-JP") + "円"}
                      </p>
                    </div>
                  </div>
                  <p className="mt-2 text-xs text-slate-500">
                    5日後平均騰落率 {fmt(item.averageReturn5Percent, "%")} ／ 未確定 {item.pending5}件 ／
                    予算対象外 {item.budgetExcluded5}件 ／ 最大逆行幅（最悪例）{fmt(item.worstAdverse5Percent, "%")}
                  </p>
                </div>
              ))}
            </div>
          </section>
        )}
        {signals.length > 0 && (
          <details className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
            <summary className="cursor-pointer text-base font-black">検出履歴と1・3・5日後の答え合わせ（{signals.length}件）</summary>
            <div className="mt-3 space-y-3">
              {signals.slice(0, 80).map(row => (
                <div key={row.code + row.strategy + row.signalTime} className="rounded-xl bg-slate-100 p-3 text-sm text-slate-900">
                  <p className="font-black">{row.code}：{FOUR_PATTERN_LABELS[row.strategy as keyof typeof FOUR_PATTERN_LABELS]}</p>
                  <p className="text-xs">判定日：{date(row.signalTime)} ／ 終値：{row.signalClose.toFixed(2)}円</p>
                  <p className="mt-1 text-xs">{row.outcomes.map(o =>
                    o.horizon + "日目：" + (o.returnPercent === null ? "未確定" : fmt(o.returnPercent, "%"))).join(" ／ ")}</p>
                  <p className="mt-1 text-[11px] text-slate-600">確定足のみでシグナル検出。未来価格は損益の答え合わせだけに使用。</p>
                </div>
              ))}
            </div>
          </details>
        )}
        <p className="text-xs leading-6 text-slate-500">
          同一銘柄・同一手法の近接5本以内のシグナルは重複除外。研究の条件・閾値は仮説であり最適化済みではありません。過去の便利な標本のため選択バイアスがあります。将来データで前向き検証が完了するまで本番通知に使用しません。
        </p>
      </div>
    </main>
  );
}
