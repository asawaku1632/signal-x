import Link from "next/link";
import { notFound } from "next/navigation";
import pool from "@/app/lib/postgres";
import BottomNav from "@/app/components/BottomNav";
import { setHorizontalAutoEnabled } from "./actions";
import { getHorizontalAutoEnabled } from "@/app/lib/research/horizontalAutoSwitch";
import { getLearningOwnerSession } from "@/app/lib/learningOwner";
import { HORIZONTAL_COMPARE_VERSION } from "@/app/lib/research/horizontalRetestComparison";
import {
  combineArchivedHorizontalTrades, type StoredHorizontalTrade,
} from "@/app/lib/research/horizontalRetestArchiveStats";

export const dynamic = "force-dynamic";
export const revalidate = 0;
type Props = { searchParams: Promise<{ save?: string; run?: string; auto?: string }> };
type AutoDayRow = { trade_date: string; status: string; codes: string[]; created_at: string; note: string | null };
type RunRow = {
  id: string; codes: string[]; first_bar_date: string; last_bar_date: string;
  base_trade_count: number; created_at: string;
};
const pct = (n: number | null) => n === null ? "—" : n.toFixed(1) + "%";
const yen = (n: number | null) => n === null ? "—" :
  (n > 0 ? "+" : "") + Math.round(n).toLocaleString("ja-JP") + "円";

export default async function HorizontalRetestArchivePage({ searchParams }: Props) {
  const { isOwner } = await getLearningOwnerSession();
  if (!isOwner) notFound();
  const params = await searchParams;

  let runs: RunRow[] = [];
  let trades: StoredHorizontalTrade[] = [];
  let totalRuns = 0;
  let researchedStocks = 0;
  let error = false;
  let autoEnabled = false;
  let autoDays: AutoDayRow[] = [];
  let autoUnavailable = false;
  try {
    const [enabled, daily] = await Promise.all([
      getHorizontalAutoEnabled(),
      pool.query<AutoDayRow>("SELECT trade_date::text,status,codes,created_at::text,note " +
        "FROM public.horizontal_retest_auto_daily_runs ORDER BY trade_date DESC LIMIT 10"),
    ]);
    autoEnabled = enabled;
    autoDays = daily.rows;
  } catch (e) {
    console.error("horizontal auto status read unavailable",e);
    autoUnavailable = true;
  }
  try {
    // No Yahoo or other provider calls when opening saved results.
    const [recent, tradeRows, totals] = await Promise.all([
      pool.query<RunRow>(
        "SELECT id::text, codes, first_bar_date::text, last_bar_date::text, " +
        "base_trade_count, created_at::text FROM public.horizontal_retest_archive_runs " +
        "WHERE detector_version=$1 ORDER BY created_at DESC LIMIT 30",
        [HORIZONTAL_COMPARE_VERSION],
      ),
      pool.query<StoredHorizontalTrade>(
        "SELECT detector_version, code, breakout_time::text, retest_time::text, " +
        "entry_time::text, exit_time::text, profit_yen_100, return_percent::text, " +
        "volume_eligible, technical_eligible FROM public.horizontal_retest_archive_trades " +
        "WHERE detector_version=$1 ORDER BY exit_time ASC, code ASC LIMIT 20001",
        [HORIZONTAL_COMPARE_VERSION],
      ),
      pool.query<{ runs: string; stocks: string }>(
        "SELECT (SELECT COUNT(*) FROM public.horizontal_retest_archive_runs " +
        "WHERE detector_version=$1)::text AS runs, " +
        "(SELECT COUNT(DISTINCT stock.code)::text FROM public.horizontal_retest_archive_runs r " +
        "CROSS JOIN LATERAL unnest(r.codes) AS stock(code) WHERE r.detector_version=$1) AS stocks",
        [HORIZONTAL_COMPARE_VERSION],
      ),
    ]);
    runs = recent.rows;
    trades = tradeRows.rows;
    totalRuns = Number(totals.rows[0]?.runs ?? 0);
    researchedStocks = Number(totals.rows[0]?.stocks ?? 0);
  } catch (err) {
    console.error("owner horizontal archive read failed", err);
    error = true;
  }
  const truncated = trades.length > 20000;
  const summary = !error && !truncated ? combineArchivedHorizontalTrades(trades) : null;

  return (
    <main className="min-h-screen bg-slate-50 px-3 py-5 pb-28 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <div className="mx-auto max-w-4xl space-y-4">
        <Link href="/admin/horizontal-retest" prefetch={false}
          className="text-sm font-black text-blue-700 dark:text-blue-300">← 水平線研究へ戻る</Link>
        <h1 className="text-2xl font-black">💾 水平線・累積研究結果</h1>
        <p className="text-sm leading-6">
          保存済みの5銘柄単位の研究を、同じ銘柄・同じ検出取引は1回だけ数えて比較します。
          <strong> 新しく株価を取得しない読み取り画面</strong>です。
        </p>
        <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950">
          <p className="font-black">🔒 本人専用・SHADOW ONLY・制限付き自動研究</p>
          <p className="mt-1">
            「検証する」だけでは保存されません。別途「結果を保存」を押した時だけ、
            同じ最大5銘柄をサーバーで1回再取得して研究専用テーブルに追加します。
            また、自動研究がONの場合は東証営業日の朝8:50に新しい最大5銘柄を1度だけ研究します。
            自動研究は本人が停止でき、失敗しても同日の再試行はしません。
            AI POWER・売買判断・LINE通知・本番学習は変更しません。
          </p>
          <p className="mt-1">
            古いスクリーンショット上の結果は自動保存されません。
            比較閾値はバージョン {HORIZONTAL_COMPARE_VERSION} で固定しています。
          </p>
        </section>
        {params.save === "saved" && (
          <p role="status" className="rounded-xl bg-blue-50 p-3 text-sm font-bold text-blue-900">
            研究結果を保存しました。同じ取引は重複計上しません。
          </p>
        )}
        {params.save === "duplicate" && (
          <p role="status" className="rounded-xl bg-blue-50 p-3 text-sm font-bold text-blue-900">
            同じ銘柄・同じ確定日足の研究は保存済みです。重複して増やしていません。
          </p>
        )}
        <section className="rounded-2xl border border-blue-200 bg-white p-4 dark:border-blue-900 dark:bg-slate-900">
          <h2 className="text-lg font-black">🤖 水平線の自動研究</h2>
          <p className="mt-2 text-sm font-bold">状態：{autoUnavailable ? "確認できません" : autoEnabled ? "ON（有効）" : "OFF（停止中）"}</p>
          <p className="mt-2 text-xs leading-6 text-slate-600 dark:text-slate-300">
            東証営業日だけ、朝8:50（日本時間）ごろに<strong>新規最大5銘柄</strong>を自動検証・保存。
            同日1回のみ、同じ銘柄を再度選びません。株価は過去約6か月の確定日足で検証。
            休場日、対象銘柄が尽きた場合、日付カレンダー未対応時は自動停止します。
            保存履歴を見るだけならYahoo通信は発生しません。
          </p>
          {!autoUnavailable && (
            <form action={setHorizontalAutoEnabled} className="mt-3">
              <input type="hidden" name="enabled" value={autoEnabled ? "off" : "on"}/>
              <button type="submit" className={"min-h-12 w-full rounded-xl px-3 text-sm font-black text-white " +
                (autoEnabled ? "bg-rose-700" : "bg-blue-700")}>
                {autoEnabled ? "水平線の自動研究を停止する" : "水平線の自動研究をONにする"}
              </button>
            </form>
          )}
          {params.auto && <p role="alert" className="mt-2 text-sm font-bold text-amber-700">
            自動研究の設定が変更できませんでした。DBと接続状況を確認してください。
          </p>}
          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
            新規有料データ契約はありませんが、1営業日につき最大5回の株価取得・DB書き込み・Vercel処理が発生します。
            対象約1,000銘柄で毎日5銘柄なら、未調査銘柄を一巡するまで約200営業日です。
            過去の2銘柄の敗因に合わせたルール変更はしていません。
          </p>
          <h3 className="mt-4 font-black">最近の自動実行（最大10営業日）</h3>
          {autoUnavailable ? (
            <p className="mt-2 text-sm text-amber-700">運転履歴の取得に失敗しました。</p>
          ) : autoDays.length === 0 ? (
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">まだ自動実行の記録はありません。</p>
          ) : (
            <div className="mt-2 space-y-2">
              {autoDays.map(day => (
                <div key={day.trade_date} className="rounded-xl bg-slate-100 p-3 text-xs dark:bg-slate-800">
                  <p className="font-black">{day.trade_date}：
                    {day.status === "COMPLETED" ? "完了" : day.status === "FAILED" ? "取得失敗・再試行なし" : "処理開始済み"}
                  </p>
                  <p className="mt-1">{day.codes.join(", ")}（{day.codes.length}銘柄）</p>
                  <p>{day.note ?? "—"}</p>
                </div>
              ))}
            </div>
          )}
        </section>
        {error ? (
          <p role="alert" className="rounded-xl bg-rose-50 p-4 text-sm font-bold text-rose-900">
            保存データを読み取れませんでした。研究専用テーブルの適用状況を確認してください。
          </p>
        ) : (
          <>
            <section className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
              <h2 className="text-lg font-black">累積研究の規模</h2>
              <div className="mt-3 grid grid-cols-3 gap-2">
                <div className="rounded-xl bg-slate-100 p-2 dark:bg-slate-800">
                  <p className="text-xs">保存した回数</p>
                  <p className="text-xl font-black">{totalRuns}</p>
                </div>
                <div className="rounded-xl bg-slate-100 p-2 dark:bg-slate-800">
                  <p className="text-xs">重複なし銘柄</p>
                  <p className="text-xl font-black">{researchedStocks}</p>
                </div>
                <div className="rounded-xl bg-slate-100 p-2 dark:bg-slate-800">
                  <p className="text-xs">重複なし確定取引</p>
                  <p className="text-xl font-black">{summary?.uniqueTrades ?? "—"}</p>
                </div>
              </div>
              <p className="mt-2 text-xs leading-6 text-slate-600 dark:text-slate-300">
                研究した銘柄数には取引0件の銘柄も含みます。
                保存日時や銘柄の選び方には偏りがあります。取引回数は独立した相場の回数と同義ではありません。
              </p>
            </section>
            {truncated && (
              <p className="rounded-xl bg-amber-50 p-3 text-sm font-bold text-amber-900">
                保存済み取引が20,000件を超えています。途中までの成績を全体成績と誤表示しないよう、
                集計を停止しました。集計範囲の拡張が必要です。
              </p>
            )}
            {summary && (
              <section className="rounded-2xl border border-indigo-200 bg-white p-4 dark:border-indigo-900 dark:bg-slate-900">
                <h2 className="text-lg font-black">①②③・重複なし累積比較</h2>
                <p className="mt-2 text-xs leading-6 text-slate-600 dark:text-slate-300">
                  ①の同じ取引を②・③の条件で絞り込む比較です。
                  過去のAI POWERを再現していません。最大ドローダウンは確定売買の累計損益に基づく簡易値です。
                </p>
                <div className="mt-3 space-y-2">
                  {summary.rows.map((row) => (
                    <div key={row.id} className="rounded-xl border border-slate-200 p-3 dark:border-slate-700">
                      <p className="text-sm font-black">{row.name}</p>
                      <div className="mt-2 grid grid-cols-2 gap-2">
                        <div className="rounded-lg bg-slate-100 p-2 dark:bg-slate-800">
                          <p className="text-xs">確定取引 / 勝率</p>
                          <p className="text-lg font-black">{row.count}件 / {pct(row.winRatePercent)}</p>
                          <p className="text-xs">{row.wins}勝 {row.losses}敗</p>
                        </div>
                        <div className="rounded-lg bg-slate-100 p-2 dark:bg-slate-800">
                          <p className="text-xs">100株ずつの仮想損益合計</p>
                          <p className="text-lg font-black">{yen(row.sumYen100)}</p>
                          <p className="text-xs">平均 {yen(row.averageYen100)}</p>
                        </div>
                      </div>
                      <p className="mt-2 text-xs leading-6">
                        平均騰落 {pct(row.averageReturnPercent)} /
                        最悪の1取引 {yen(row.worstYen100)} /
                        簡易最大ドローダウン {yen(row.drawdownYen100)}
                      </p>
                      {row.count < 20 && <p className="mt-1 text-xs font-bold text-amber-700 dark:text-amber-300">
                        20取引未満：優劣判定には不足。{row.count === 0 ? "対象0件は利益0円の実績ではありません。" : ""}
                      </p>}
                    </div>
                  ))}
                </div>
                <p className="mt-2 text-xs leading-6 text-slate-600 dark:text-slate-300">
                  全モデル同一の100株単位で単純合計した仮想損益です（資金制約なし）。
                  税・手数料は含みません。推定滑り片道0.1%。勝率と利益は共に評価が必要です。
                  別期間・別銘柄で再確認するまでは本番に採用しません。
                </p>
              </section>
            )}
            <section className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
              <h2 className="text-lg font-black">最近の保存履歴（最大30回）</h2>
              {runs.length === 0 ? (
                <p className="mt-2 text-sm">まだ保存履歴はありません。水平線研究から最大5銘柄ずつ保存してみよう。</p>
              ) : runs.map(run => (
                <div key={run.id} className="mt-3 rounded-xl bg-slate-100 p-3 text-sm dark:bg-slate-800">
                  <p className="font-black">{run.codes.join(", ")}</p>
                  <p className="text-xs">
                    {new Date(run.created_at).toLocaleString("ja-JP", {timeZone:"Asia/Tokyo"})} /
                    日足 {run.first_bar_date}〜{run.last_bar_date} /
                    元の①確定取引 {run.base_trade_count}件
                  </p>
                </div>
              ))}
            </section>
          </>
        )}
        <p className="text-xs leading-6 text-slate-500 dark:text-slate-400">
          観測済み取引の初回記録を保持し、後日の再取得で既存の損益を改ざんしません。
          別の検証用銘柄・期間を増やしても上昇や利益を保証するものではありません。
        </p>
      </div>
      <BottomNav />
    </main>
  );
}
