import Link from "next/link";
import { notFound } from "next/navigation";
import { getLearningOwnerSession } from "@/app/lib/learningOwner";
import { fetchCohort } from "@/app/lib/research/shadowCandleYahoo";
import { studyHorizontalRetest } from "@/app/lib/research/horizontalRetest";
import { compareHorizontalRetest, HORIZONTAL_VARIANTS } from "@/app/lib/research/horizontalRetestComparison";
import { saveHorizontalRetestStudy } from "./actions";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Props = { searchParams: Promise<{ codes?: string; preset?: string; save?: string }> };
const PRESETS: Record<string, string> = {
  A: "3182,3387,6855,7203,9984",
  B: "1605,2760,3994,5805,8058",
};
const yen = (n: number) => (n > 0 ? "+" : "") + Math.round(n).toLocaleString("ja-JP") + "円";
const percent = (n: number | null) => n === null ? "—" : n.toFixed(1) + "%";

export default async function HorizontalRetestPage({ searchParams }: Props) {
  const { isOwner } = await getLearningOwnerSession();
  if (!isOwner) notFound();

  const params = await searchParams;
  const preset = typeof params.preset === "string" && Object.hasOwn(PRESETS, params.preset)
    ? params.preset : null;
  const raw = preset ? PRESETS[preset] : typeof params.codes === "string" ? params.codes.slice(0, 80) : "";
  const attempted = raw.trim().length > 0;
  const codes = raw.trim().split(/[\s,、]+/).filter(Boolean);
  const inputError = attempted && (!codes.length || codes.length > 5 ||
    new Set(codes).size !== codes.length || codes.some(code => !/^[0-9]{4}$/.test(code)))
    ? "日本株4桁コードを重複なく1〜5件指定してください。" : null;

  // Strict owner check BEFORE the deliberate on-demand fetch.
  // No background job, write, cache or automatic universe scan.
  const loaded = attempted && !inputError ? await fetchCohort(codes) : [];
  const rows = loaded.filter(r => !r.error).map(r => ({
    code: r.code, report: studyHorizontalRetest(r.candles),
  }));
  const excluded = loaded.filter(r => r.error);
  const allTrades = rows.flatMap(r => r.report.trades.map(t => ({ code: r.code, ...t })));
  const wins = allTrades.filter(t => t.profitYen100 > 0).length;
  const total = allTrades.reduce((s, t) => s + t.profitYen100, 0);
  const allSignals = rows.reduce((s, r) => s + r.report.breakoutCount, 0);
  const retests = rows.reduce((s, r) => s + r.report.retestCount, 0);
  const comparison = compareHorizontalRetest(loaded.filter(r => !r.error).map(r => ({ code: r.code, candles: r.candles })));

  return (
    <main className="min-h-screen bg-slate-50 px-3 py-5 pb-24 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <div className="mx-auto max-w-4xl space-y-4">
        <Link href="/admin/learning-hub" className="text-sm font-bold text-blue-700 dark:text-blue-300">
          ← 学習管理へ戻る
        </Link>
        <Link href="/admin/horizontal-retest/archive" prefetch={false} className="inline-flex min-h-11 items-center rounded-xl border border-indigo-300 px-4 text-sm font-black text-indigo-700 dark:text-indigo-300">
          💾 保存履歴・累積勝率を見る
        </Link>
        <header>
          <h1 className="text-2xl font-black">📏 水平線ブレイク・押し目研究</h1>
          <p className="mt-2 text-sm leading-6">2回以上止められた高値を突破し、水平線へ戻って陽線で反発した場面を過去の日足で研究する。</p>
        </header>
        <section className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm leading-6 text-amber-950">
          <p className="font-black">🔒 本人専用 / SHADOW ONLY / 本番の売買判定・通知・学習DBは変更しません</p>
          <p className="mt-2">銘柄を指定して「検証する」を押したときのみ、選択した最大5銘柄の過去6か月の参考日足を取得します（最大135本で計算）。自動収集・定期実行はなく、明示的に「研究結果を保存」を押した場合だけ研究専用DBに記録します。</p>
          <p className="mt-2">新たな有料データ契約は不要。ただし外部データの利用条件の確認が必要で、クリック時の通信とサーバー処理は発生します。</p>
        </section>
        <section className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
          <form action="/admin/horizontal-retest" method="get">
            <label className="block text-sm font-bold" htmlFor="codes">検証する銘柄（1〜5件、カンマ区切り）</label>
            <input id="codes" name="codes" maxLength={80} defaultValue={raw}
              placeholder="例：3182,3387,6855,7203,9984"
              className="mt-2 w-full rounded-xl border border-slate-300 bg-white p-3 text-base text-slate-900" />
            <div className="mt-3 grid grid-cols-3 gap-2">
              <button type="submit" className="min-h-12 rounded-xl bg-blue-700 px-2 text-sm font-bold text-white">検証する</button>
              <button type="submit" name="preset" value="A" className="min-h-12 rounded-xl border border-blue-300 p-2 text-xs font-bold text-blue-700 dark:text-blue-300">サンプルA</button>
              <button type="submit" name="preset" value="B" className="min-h-12 rounded-xl border border-blue-300 p-2 text-xs font-bold text-blue-700 dark:text-blue-300">サンプルB</button>
            </div>
          </form>
          <p className="mt-2 text-xs text-slate-500">初期表示では株価を取得しません。サンプルは恣意的に選んだ銘柄であり、全市場の勝率を示しません。</p>
          {inputError && <p role="alert" className="mt-3 text-sm font-bold text-red-600">{inputError}</p>}
        </section>
        {params.save && <p role="alert" className="rounded-xl bg-amber-50 p-3 text-sm font-bold text-amber-900">
          {params.save === "invalid" ? "銘柄コードが不正なため保存できませんでした。" :
           params.save === "unavailable" ? "一部の株価データが不足したため、どの銘柄も保存しませんでした。" :
           "研究データを保存できませんでした。専用テーブル・接続状態を確認してください。"}
        </p>}
        {attempted && !inputError && (
          <>
            <section className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
              <h2 className="text-lg font-black">検証結果（日足・仮想100株）</h2>
              <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                <div className="rounded-xl bg-slate-100 p-3 dark:bg-slate-800"><p className="text-xs">突破候補</p><p className="text-xl font-black">{allSignals}件</p></div>
                <div className="rounded-xl bg-slate-100 p-3 dark:bg-slate-800"><p className="text-xs">押し目反発</p><p className="text-xl font-black">{retests}件</p></div>
                <div className="rounded-xl bg-slate-100 p-3 dark:bg-slate-800"><p className="text-xs">確定取引 / 勝率</p><p className="text-xl font-black">{allTrades.length} / {percent(allTrades.length ? wins / allTrades.length * 100 : null)}</p></div>
                <div className="rounded-xl bg-slate-100 p-3 dark:bg-slate-800"><p className="text-xs">仮想損益合計</p><p className="text-xl font-black">{yen(total)}</p></div>
              </div>
              <p className="mt-3 text-xs leading-6 text-slate-600 dark:text-slate-300">
                手法：日足20日平均 ＞ 50日平均、出来高1.2倍以上、過去65本以内に独立した高値接触2回以上。
                終値で上抜け後5営業日以内に反発陽線を確認、翌営業日寄り付き買い。
                損切りは水平線／押し目安値の下、利確はリスクの2倍、最大5営業日保有。
                同一足で利確と損切りが重なる場合は損切り優先。売買時の想定滑りは片道0.1%。税・手数料は含まず、100株固定・資金制約なし。
                未確定の取引は勝率・利益から除外します。
              </p>
              {allTrades.length === 0 && <p className="mt-3 text-sm font-bold text-amber-700">確定できた取引はまだ0件です。0%の勝率という意味ではありません。</p>}
            </section>
            <section className="rounded-2xl border border-indigo-200 bg-white p-3 sm:p-4 dark:border-indigo-900 dark:bg-slate-900">
              <h2 className="text-lg font-black">📊 同じ取引を3条件で比べる（研究用）</h2>
              <p className="mt-2 text-xs leading-6 text-slate-600 dark:text-slate-300">
                この比較は<strong>①で確定した同じ取引のうち、②・③ならエントリー対象だったか</strong>を判定するものです。
                追加条件による新規の別取引は発生させず、買値・売値は①から変えません。
                <strong>過去のAI POWER・実際のAI予測を復元した結果ではありません。</strong>
              </p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                データ：取得できた{comparison.cohortCount}銘柄・確定済み日足 /
                突破{comparison.totalBreakouts}件 / 押し目反発{comparison.totalRetests}件 /
                判定済み取引{comparison.completedBaseTrades}件
              </p>
              <div className="mt-3 space-y-2">
                {comparison.comparison.map(stat => {
                  const definition = HORIZONTAL_VARIANTS.find(v => v.id === stat.id)!;
                  return (
                    <div key={stat.id} className="rounded-xl border border-slate-200 p-3 dark:border-slate-700">
                      <p className="text-sm font-black">{definition.name}</p>
                      <p className="mt-1 text-[11px] leading-5 text-slate-500 dark:text-slate-400">{definition.criteria}</p>
                      <div className="mt-2 grid grid-cols-2 gap-2">
                        <div className="rounded-lg bg-slate-100 p-2 dark:bg-slate-800">
                          <p className="text-[11px] text-slate-600 dark:text-slate-300">対象 / 勝率</p>
                          <p className="text-lg font-black">{stat.eligible}件 / {percent(stat.winRatePercent)}</p>
                          <p className="text-[11px]">勝{stat.wins}・負{stat.losses}</p>
                        </div>
                        <div className="rounded-lg bg-slate-100 p-2 dark:bg-slate-800">
                          <p className="text-[11px] text-slate-600 dark:text-slate-300">仮想100株損益合計</p>
                          <p className="text-lg font-black">{stat.eligible ? yen(stat.profitYen100) : "—"}</p>
                          <p className="text-[11px]">①から除外 {stat.rejectedFromBase}件</p>
                        </div>
                      </div>
                      <p className="mt-2 text-xs leading-5">
                        平均騰落率 {percent(stat.averageReturnPercent)} /
                        最悪の1取引 {stat.worstProfitYen100 === null ? "—" : yen(stat.worstProfitYen100)} /
                        簡易最大ドローダウン {stat.maxDrawdownYen100 === null ? "—" : yen(stat.maxDrawdownYen100)}
                      </p>
                      {stat.eligible === 0 && <p className="mt-1 text-xs font-bold text-amber-700 dark:text-amber-300">
                        対象0件：勝率や収益性の優劣は判定できません。
                      </p>}
                    </div>
                  );
                })}
              </div>
              {comparison.entries.length > 0 && (
                <details className="mt-3 rounded-xl border border-slate-200 p-3 dark:border-slate-700">
                  <summary className="cursor-pointer text-sm font-black">銘柄別：どの条件で除外された？（{comparison.entries.length}取引）</summary>
                  <div className="mt-3 space-y-2">
                    {comparison.entries.map(entry => (
                      <div key={entry.code + "-" + entry.breakoutTime + "-" + entry.entryTime}
                        className="rounded-lg bg-slate-100 p-3 text-xs leading-6 dark:bg-slate-800">
                        <p className="text-sm font-black">{entry.code}：{yen(entry.trade.profitYen100)}</p>
                        <p>①対象 / ②{entry.eligible.TREND_VOLUME ? "対象" : "除外"} / ③{entry.eligible.TECHNICAL ? "対象" : "除外"}</p>
                        <p>突破時出来高倍率 {entry.breakoutVolumeRatio === null ? "不明" : entry.breakoutVolumeRatio.toFixed(2) + "倍"} /
                          MA差 {entry.maSpreadPercent === null ? "不明" : entry.maSpreadPercent.toFixed(2) + "%"}</p>
                        <p>反発時 RSI {entry.rsiAtRetest ?? "不明"} /
                          MACD {entry.macdHistogramAtRetest === null ? "不明" : entry.macdHistogramAtRetest.toFixed(2)}</p>
                        <p>追加条件：{entry.failed.length ? entry.failed.join("・") : "すべて通過"}</p>
                      </div>
                    ))}
                  </div>
                </details>
              )}
              <p className="mt-3 text-[11px] leading-5 text-slate-600 dark:text-slate-300">
                ②・③は①の取引の部分集合。勝率が上がっても選んだ過去データへの過剰適合の可能性があります。
                比較の閾値は研究仮説であり、後から都合良く変更しないで別期間・別銘柄で確認が必要です。
                損益は100株×各取引の単純合計（資金制約なし）、簡易ドローダウンは確定売買損益のみ。
                税・手数料は別、買い／売りの想定滑り片道0.1%。本番判定・通知・保存には反映しません。
              </p>
            </section>
            {loaded.length === codes.length && loaded.every(r => !r.error && r.candles.length >= 60) && (
              <section className="rounded-2xl border border-blue-200 bg-white p-4 dark:border-blue-900 dark:bg-slate-900">
                <h2 className="text-lg font-black">💾 この5銘柄の研究を蓄積する</h2>
                <p className="mt-2 text-xs leading-6 text-slate-600 dark:text-slate-300">
                  保存ボタンを押した場合のみ、本人確認後、同じ最大5銘柄の確定日足をもう1回取得して再計算します。
                  保存後は<a href="/admin/horizontal-retest/archive" className="font-bold underline">累積研究ページ</a>で①②③を比較。
                  同じ銘柄・同じ取引は重複計上しません。0取引の銘柄も「調べた銘柄」として残ります。
                </p>
                <form action={saveHorizontalRetestStudy} className="mt-3">
                  <input type="hidden" name="codes" value={codes.join(",")} />
                  <button type="submit" className="min-h-12 w-full rounded-xl bg-blue-700 px-3 text-sm font-black text-white">
                    研究結果を保存（最大5銘柄・再取得1回）
                  </button>
                </form>
                <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                  自動保存なし。1回の保存で最大5回の株価通信とVercelの関数処理が発生し、利用枠を消費する可能性があります。
                </p>
              </section>
            )}
            <section className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
              <h2 className="text-lg font-black">銘柄別の結果</h2>
              <div className="mt-3 space-y-2">
                {rows.map(({ code, report }) => (
                  <div key={code} className="rounded-xl border border-slate-200 p-3 text-sm dark:border-slate-700">
                    <p className="font-black">{code}　<span className="font-normal text-slate-500">{report.candleCount}本</span></p>
                    <p className="mt-1">突破 {report.breakoutCount}件 → 反発 {report.retestCount}件 → 確定 {report.completed}件</p>
                    <p className="font-bold">勝率 {percent(report.winRatePercent)} / 仮想損益 {yen(report.profitYen100)}</p>
                  </div>
                ))}
                {excluded.map(r => <p key={r.code} className="text-sm text-red-700">{r.code}：{r.error}</p>)}
              </div>
            </section>
            {allTrades.length > 0 && (
              <section className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
                <h2 className="text-lg font-black">確定した取引（新しい順・最大10件）</h2>
                <div className="mt-3 space-y-2">
                  {[...allTrades].sort((a,b) => b.entryIndex - a.entryIndex).slice(0,10).map((t, i) => (
                    <div key={t.code + "-" + t.breakoutIndex + "-" + i} className="rounded-xl bg-slate-100 p-3 text-sm dark:bg-slate-800">
                      <p className="font-black">{t.code}｜抵抗線 {t.resistance.toLocaleString("ja-JP")}円（接触{t.touches}回）</p>
                      <p className="mt-1">買い {Math.round(t.entry).toLocaleString("ja-JP")}円 / 売り {Math.round(t.exit).toLocaleString("ja-JP")}円　{t.reason}</p>
                      <p className="font-bold">100株損益 {yen(t.profitYen100)} ({percent(t.returnPercent)})</p>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </>
        )}
        <p className="text-xs leading-6 text-slate-500 dark:text-slate-400">
          ※研究結果は過去データを使った仮説の検証で、将来の勝率を保証しません。
          データ期間・銘柄選択・約定の再現性・株式分割・配当調整・取引コストなどに制限があります。
          本番スコアや通知、学習DBには反映されません。本人が明示的に保存したときだけ独立した研究DBに記録します。
        </p>
      </div>
    </main>
  );
}
