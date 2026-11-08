import Link from "next/link";
import { notFound } from "next/navigation";
import BottomNav from "@/app/components/BottomNav";
import NecklineFeatureComparison, { type NecklineFeatureAnalysis } from "@/app/components/analysis/NecklineFeatureComparison";
import { getLearningOwnerSession } from "@/app/lib/learningOwner";
import { fetchCohort } from "@/app/lib/research/shadowCandleYahoo";
import { auditNecklineQuality, NECKLINE_QUALITY_VERSION } from "@/app/lib/research/necklineQualityAudit.mjs";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Props = { searchParams: Promise<{ codes?: string; run?: string }> };
type Metric = {
  completed: number; winRatePercent: number | null; meanPercent: number | null;
  medianPercent: number | null; worstPercent: number | null;
};
type Event = {
  code: string; firstSeenDate: string; low1Date: string; low2Date: string;
  low1: number; low2: number; neckline: number; status: string;
  breakoutDate: string | null; earlyReturn3: number | null; earlyReturn5: number | null;
  breakoutReturn3: number | null; breakoutReturn5: number | null;
};
const defaultCodes = "7164,3774,5929,7752,4331";
const pct = (n: number | null) => n == null ? "未確定" : (n > 0 ? "+" : "") + n.toFixed(2) + "%";
const yen = (n: number) => Math.round(n).toLocaleString("ja-JP") + "円";
const statuses: Record<string, string> = {
  WATCH: "上抜け待ち", BREAKOUT: "終値上抜け",
  INVALIDATED: "安値割れで失効", EXPIRED: "20営業日で終了",
};
function MetricRow({ name, metric }: { name: string; metric: Metric }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3">
      <p className="text-sm font-black">{name}</p>
      <p className="mt-2 text-xl font-black">{pct(metric.meanPercent)}</p>
      <p className="mt-1 text-xs leading-5 text-slate-600">
        事後平均・コスト控除後 / {metric.completed}件確定<br />
        プラス率 {metric.winRatePercent == null ? "未確定" : metric.winRatePercent.toFixed(1) + "%"}<br />
        中央値 {pct(metric.medianPercent)} / 最悪 {pct(metric.worstPercent)}
      </p>
    </div>
  );
}

export default async function NecklineQualityPage({ searchParams }: Props) {
  const { isOwner } = await getLearningOwnerSession();
  if (!isOwner) notFound();

  const params = await searchParams;
  const run = params.run === "1";
  const raw = typeof params.codes === "string" ? params.codes.slice(0, 100) : "";
  const codes = raw.trim().split(/[\s,、]+/).filter(Boolean);
  const inputError = run && (raw.length === 0 || codes.length < 1 || codes.length > 5
    || codes.some(code => !/^[0-9]{4}$/.test(code))
    || new Set(codes).size !== codes.length)
    ? "4桁の銘柄コードを重複なしで1〜5件入力してください。" : null;

  // Explicit owner-initiated GET only. Bounded 5-stock, 3-way concurrency
  // source fetch already enforces completed daily OHLC. Never writes to DB.
  const requestedAt = new Date();
  const loaded = run && !inputError ? await fetchCohort(codes) : [];
  const result = loaded.length
    ? auditNecklineQuality(loaded, requestedAt) as {
      usableSymbols: number; requestedSymbols: number; completedDailyBars: number;
      earliestDate: string|null; latestDate: string|null; candidates: number;
      byStatus: { watch: number; breakout: number; invalidated: number; expired: number };
      decidedCandidates: number; resolvedBreakoutPercent: number|null;
      early3: Metric; early5: Metric; breakout3: Metric; breakout5: Metric;
      featureAnalysis: NecklineFeatureAnalysis;
      details: {code:string;status:string;reason:string|null;barCount:number;candidateCount:number}[];
      events: Event[];
    } : null;

  return (
    <>
      <main className="min-h-screen bg-slate-50 pb-28 text-slate-900">
        <div className="mx-auto max-w-4xl space-y-4 px-3 pt-5 sm:px-6">
          <Link href="/admin/learning-hub" className="inline-flex min-h-11 items-center text-sm font-black text-blue-700">
            ← 学習管理室へ戻る
          </Link>
          <header className="rounded-2xl border border-blue-200 bg-white p-4">
            <p className="text-xs font-black text-blue-700">本人専用・確定日足の事後検証</p>
            <h1 className="mt-2 text-xl font-black sm:text-2xl">🔬 底①・底②・ネックラインの検出精度を調べる</h1>
            <p className="mt-2 text-sm leading-6 text-slate-700">
              実際の銘柄で「上抜けできたか」「安値を割ったか」「20営業日で終わったか」を比較。
              見つかった候補は成功・失敗・未確定を含めて集計します。
            </p>
            <p className="mt-2 text-xs leading-5 text-amber-800">
              買いシグナルではありません。形の真偽を人が判定した誤検出率ではなく、
              上抜けしなかった割合を参考指標として確認する研究です。
            </p>
          </header>
          <section className="rounded-2xl border border-slate-200 bg-white p-4">
            <form method="get" action="/admin/neckline-quality">
              <input type="hidden" name="run" value="1"/>
              <label htmlFor="codes" className="text-sm font-bold">検証する日本株（1〜5銘柄・4桁コード）</label>
              <input id="codes" name="codes" maxLength={80} defaultValue={raw || defaultCodes}
                className="mt-2 min-h-12 w-full rounded-xl border border-slate-300 px-3 text-base" />
              <button type="submit" className="mt-3 min-h-12 w-full rounded-xl bg-blue-700 px-4 text-sm font-black text-white">
                🔬 過去の確定日足を検証する
              </button>
            </form>
            <p className="mt-2 text-xs leading-5 text-slate-600">
              ボタンを押したときだけ、指定銘柄についてYahooの過去6か月・最大135本の日足を取得。
              最大5銘柄、同時3件まで。DB保存・自動スキャン・通知・発注は一切行いません。
            </p>
            <p className="mt-1 text-xs text-slate-500">
              初期コードは画面確認用の例で、ランダム抽出ではありません。結果を全市場に一般化しないでください。
            </p>
            {inputError && <p role="alert" className="mt-3 rounded-lg bg-red-50 p-3 text-sm font-bold text-red-700">{inputError}</p>}
          </section>

          {result && (
            <>
              <section className="rounded-2xl border border-blue-200 bg-white p-4" aria-label="検証データの出所">
                <h2 className="text-base font-black">📋 今回の検証条件</h2>
                <p className="mt-2 text-xs leading-6 text-slate-700">
                  研究コード {NECKLINE_QUALITY_VERSION}<br />
                  出所：Yahoo参考日足 / 2026年11月以降も手動で再取得される履歴<br />
                  今回の実行：{requestedAt.toLocaleString("ja-JP", {timeZone:"Asia/Tokyo"})} 日本時間<br />
                  過去データ範囲：{result.earliestDate ?? "未取得"} 〜 {result.latestDate ?? "未取得"}<br />
                  取得成功 {result.usableSymbols}/{result.requestedSymbols}銘柄・確定日足 {result.completedDailyBars}本<br />
                  翌営業日始値で仮購入し3・5営業日目終値で仮売却、往復コスト0.2ポイントを差し引いた計算
                </p>
                <p className="mt-2 text-xs leading-5 text-amber-800">
                  過去日足を後から再生した研究であり、事前固定のFORWARD成績ではありません。
                  再取得時に履歴・株価調整等が変わる可能性があります。取引可能性・税金・スリッページは未検証。
                </p>
              </section>
              <section className="rounded-2xl border border-slate-200 bg-white p-4">
                <h2 className="text-base font-black">📊 候補のその後</h2>
                <div className="mt-3 grid grid-cols-2 gap-2 text-center sm:grid-cols-4">
                  {[
                    ["検出候補", result.candidates, "text-slate-900"],
                    ["上抜け", result.byStatus.breakout, "text-emerald-700"],
                    ["失効・期限終了", result.byStatus.invalidated + result.byStatus.expired, "text-rose-700"],
                    ["未確定", result.byStatus.watch, "text-amber-700"],
                  ].map(([label, value, cls]) => (
                    <div key={String(label)} className="rounded-xl bg-slate-50 p-3">
                      <p className="text-xs font-bold text-slate-500">{label}</p>
                      <p className={`mt-1 text-2xl font-black ${cls}`}>{value}</p>
                    </div>
                  ))}
                </div>
                <p className="mt-3 text-xs leading-5 text-slate-600">
                  判定が終了した {result.decidedCandidates}件のうち、上抜けした割合：
                  <strong> {result.resolvedBreakoutPercent == null ? "未算出" : result.resolvedBreakoutPercent.toFixed(1) + "%"}</strong>。
                  未確定は分母から除外。この割合は「買って勝てる確率」ではありません。
                </p>
                <p className="mt-2 text-xs leading-5 text-slate-600">
                  安値割れ {result.byStatus.invalidated}件 / 期限終了 {result.byStatus.expired}件。
                  失効・期限終了を「形の誤検出」と断定はできません。
                </p>
              </section>
              <section className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                <h2 className="text-base font-black">💹 3・5営業日後の事後損益</h2>
                <p className="mt-1 text-xs leading-5 text-slate-600">
                  全候補の翌日始値と、上抜けした候補の翌日始値を別々に計算。
                  後者だけを見ると、上抜けしなかった候補を除外する選択バイアスがあります。
                </p>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  <MetricRow name="全候補・3営業日後" metric={result.early3}/>
                  <MetricRow name="全候補・5営業日後" metric={result.early5}/>
                  <MetricRow name="上抜け後・3営業日後" metric={result.breakout3}/>
                  <MetricRow name="上抜け後・5営業日後" metric={result.breakout5}/>
                </div>
                <p className="mt-2 text-xs text-slate-600">
                  未成熟の結果は「未確定」として数えず、後から勝ちに書き換えません。
                  同銘柄内の複数候補は独立したサンプルではないため、プラス率を勝率予測として使用しないでください。
                </p>
              </section>
              <NecklineFeatureComparison analysis={result.featureAnalysis} />
              <section className="rounded-2xl border border-slate-200 bg-white p-4">
                <h2 className="text-base font-black">🔎 銘柄別の品質・除外理由</h2>
                <div className="mt-2 space-y-2">
                  {result.details.map(item => (
                    <div key={item.code} className="rounded-lg border border-slate-200 p-3 text-xs leading-5">
                      <strong>{item.code}</strong> ・ {item.status === "OK" ? "有効" : "除外"} ／
                      日足 {item.barCount}本 ／ 候補 {item.candidateCount}件
                      {item.reason && <p className="text-rose-700">理由：{item.reason}</p>}
                    </div>
                  ))}
                </div>
              </section>
              <section className="rounded-2xl border border-slate-200 bg-white p-4">
                <h2 className="text-base font-black">📋 検出された候補の記録</h2>
                <p className="mt-1 text-xs leading-5 text-slate-600">
                  計{result.events.length}件。新しい候補から最大50件を表示。集計は全件を対象。
                  底①・底②の確定後に初検出した日付を表示します。
                </p>
                {result.events.length === 0 ? (
                  <p className="mt-3 rounded-lg bg-slate-50 p-3 text-sm font-bold">今回の銘柄・期間では候補が見つかりませんでした。</p>
                ) : (
                  <div className="mt-3 space-y-2">
                    {result.events.slice(0, 50).map((event, index) => (
                      <details key={event.code + event.firstSeenDate + index}
                        className="rounded-xl border border-slate-200 p-3">
                        <summary className="cursor-pointer text-sm font-black">
                          {event.code}　{event.firstSeenDate}　{statuses[event.status] ?? "判定保留"}
                        </summary>
                        <p className="mt-2 text-xs leading-6 text-slate-700">
                          底①：{event.low1Date}（{yen(event.low1)}） /
                          底②：{event.low2Date}（{yen(event.low2)}）<br />
                          ネックライン候補：{yen(event.neckline)}<br />
                          上抜け日：{event.breakoutDate ?? "未確認"}<br />
                          全候補翌日始値から：3日 {pct(event.earlyReturn3)} / 5日 {pct(event.earlyReturn5)}<br />
                          上抜け翌日始値から：3日 {pct(event.breakoutReturn3)} / 5日 {pct(event.breakoutReturn5)}
                        </p>
                        <Link href={`/analysis/${event.code}`} className="mt-2 inline-flex min-h-10 items-center text-xs font-black text-blue-700">
                          この銘柄のチャートを確認 →
                        </Link>
                      </details>
                    ))}
                  </div>
                )}
              </section>
            </>
          )}
        </div>
      </main>
      <BottomNav />
    </>
  );
}
