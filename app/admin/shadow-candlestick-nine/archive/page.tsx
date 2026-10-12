import Link from "next/link";
import { notFound } from "next/navigation";
import pool from "@/app/lib/postgres";
import BottomNav from "@/app/components/BottomNav";
import { getLearningOwnerSession } from "@/app/lib/learningOwner";
import { SHADOW_CANDLE_DETECTOR_VERSION } from "@/app/lib/research/shadowCandlestickNine";
import {
  combineArchivedShadowRuns,
  type ArchivedShadowRun,
} from "@/app/lib/research/shadowCandleArchiveStats";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type SavedRun = ArchivedShadowRun & {
  batch_key: string;
  codes: string[];
  requested_count: number;
  succeeded_count: number;
  first_bar_date: string;
  last_bar_date: string;
  created_at: string;
};

type AutoDailyRow = {
  trade_date: string;
  status: string;
  codes: string[];
  created_at: string;
  finished_at: string | null;
  note: string | null;
};

function percent(value: number | null) {
  return value === null ? "—" : value.toFixed(1) + "%";
}
function signed(value: number | null) {
  return value === null ? "—" : (value > 0 ? "+" : "") + value.toFixed(2) + "%";
}

export default async function ShadowCandleArchivePage() {
  const { isOwner } = await getLearningOwnerSession();
  if (!isOwner) notFound();

  let runs: SavedRun[] = [];
  let error = false;
  try {
    const result = await pool.query<SavedRun>(`
      SELECT id::text, detector_version, batch_key, codes,
        requested_count, succeeded_count,
        first_bar_date::text, last_bar_date::text, created_at::text, events
      FROM public.shadow_candle_research_runs
      WHERE detector_version = $1
      ORDER BY created_at DESC LIMIT 50
    `, [SHADOW_CANDLE_DETECTOR_VERSION]);
    runs = result.rows;
  } catch (e) {
    console.error("shadow archive read failed", e);
    error = true;
  }

  let autoDaily: AutoDailyRow[] = [];
  let autoStatusUnavailable = false;
  try {
    const result = await pool.query<AutoDailyRow>(`
      SELECT trade_date::text, status, codes, created_at::text,
        finished_at::text, note
      FROM public.shadow_candle_auto_daily_runs
      ORDER BY trade_date DESC LIMIT 10
    `);
    autoDaily = result.rows;
  } catch (e) {
    console.error("shadow auto research status read failed", e);
    autoStatusUnavailable = true;
  }

  const autoEnabled = process.env.SHADOW_CANDLE_AUTO_ENABLED === "true";
  const totals = combineArchivedShadowRuns(runs);
  const ordered = [...totals.rows].sort((a, b) =>
    b.horizons[2].completed - a.horizons[2].completed || a.patternId.localeCompare(b.patternId));
  return (
    <main className="min-h-screen bg-slate-50 pb-28 text-slate-900">
      <div className="mx-auto max-w-4xl px-3 pt-5 sm:px-6">
        <Link href="/admin/shadow-candlestick-nine/batch" prefetch={false}
          className="text-sm font-black text-blue-700">← 5銘柄比較へ戻る</Link>
        <h1 className="mt-4 text-2xl font-black">💾 ローソク足研究の保存履歴</h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          本人が保存した結果と、明示的に有効化された研究用の定期取得結果を集計します。
          同じ銘柄・検出日・パターンの記録は重複して数えません。
          AI POWER・LINE通知・本番の学習には一切反映しません。
        </p>

        <section className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6">
          <p className="font-black">
            🔒 本人限定・SHADOW ONLY・自動研究：{autoEnabled ? "有効" : "停止中"}
          </p>
          <p className="mt-1">
            「まとめて検証」で結果を見ただけでは保存されません。別途「研究結果を保存」を
            押したときだけ、最大5銘柄の確定日足を再取得して検証・保存します。
            保存内容には元の全ローソク足そのものは含めず、検出イベントと研究成績を記録します。
          </p>
          <p className="mt-1">保存済みデータの表示ではYahooへの新しい株価取得は発生しません。</p>
          <p className="mt-1">
            自動研究は有効化時のみ、東証営業日朝8:35（日本時間）に最大5銘柄を1回だけ照合し、
            過去に調べた銘柄は選びません。失敗した日の自動再取得はしません。
          </p>
        </section>

        <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
          <h2 className="text-lg font-black">🤖 自動研究の運転履歴（直近10営業日）</h2>
          <p className="mt-1 text-xs text-slate-600">
            有効化：{autoEnabled ? "ON" : "OFF"} ／1営業日最大5銘柄
            ／休場日停止／同日再試行なし
          </p>
          {autoStatusUnavailable ? (
            <p className="mt-3 text-sm font-bold text-amber-800">
              運転履歴を取得できません。専用テーブルや接続状態を確認してください。
            </p>
          ) : autoDaily.length === 0 ? (
            <p className="mt-3 text-sm text-slate-600">
              自動研究はまだ実行されていません。既存10銘柄の手動保存はそのまま残っています。
            </p>
          ) : autoDaily.map(row => (
            <div key={row.trade_date} className="mt-3 border-t border-slate-100 pt-3 text-xs leading-6">
              <p className="font-black">{row.trade_date} ／{
                row.status === "COMPLETED" ? "完了" : row.status === "FAILED" ? "失敗・再試行なし" : "処理開始済み"
              }</p>
              <p>{row.codes.join(", ")}（{row.codes.length}銘柄）</p>
              <p className="text-slate-500">開始：{
                new Date(row.created_at).toLocaleString("ja-JP", {timeZone:"Asia/Tokyo"})
              } ／状態：{row.note ?? "—"}</p>
            </div>
          ))}
        </section>

        {error ? (
          <p role="alert" className="mt-4 rounded-2xl bg-rose-50 p-4 text-sm font-bold text-rose-800">
            保存履歴を読み取れませんでした。保存用テーブル・接続権限を確認してください。
          </p>
        ) : (
          <>
            <section className="mt-4 rounded-2xl border border-blue-200 bg-white p-4">
              <h2 className="font-black">重複を除いた保存済みの検証</h2>
              <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                {[
                  ["保存した回数", runs.length + "回"],
                  ["対象銘柄", totals.stockCount + "銘柄"],
                  ["検出イベント", totals.eventCount + "件"],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-xl bg-blue-50 p-3">
                    <p className="text-xs text-slate-600">{label}</p>
                    <p className="mt-1 text-lg font-black">{value}</p>
                  </div>
                ))}
              </div>
              <p className="mt-2 text-xs leading-5 text-slate-600">
                同一条件の再保存は増えません。合算は直近最大50回の保存記録、同一検出ロジック
                {SHADOW_CANDLE_DETECTOR_VERSION} のみを対象にします。
              </p>
            </section>
            <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
              <h2 className="font-black">9種類の保存済み5営業日後成績</h2>
              <p className="mt-2 text-xs leading-5 text-slate-600">
                「方向一致」は買い型で上昇、下落型で下落した割合。売買勝率ではありません。
                未確定の未来足を分母には入れません。手数料・スリッページ・同銘柄相関などは未考慮です。
              </p>
              <div className="mt-3 space-y-2">
                {ordered.map(row => {
                  const h = row.horizons[2];
                  return (
                    <article key={row.patternId} className="rounded-xl border border-slate-200 p-3">
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="text-sm font-black">{row.name}</h3>
                        <span className={`rounded-lg px-2 py-1 text-xs font-bold ${row.direction === "BUY"
                          ? "bg-emerald-50 text-emerald-800" : "bg-rose-50 text-rose-800"}`}>
                          {row.direction === "BUY" ? "上昇型" : "下落型"}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-slate-600">
                        検出 {row.detections}件 ／{row.codes}銘柄 ／5日結果 {h.completed}件
                      </p>
                      <div className="mt-2 grid grid-cols-3 gap-2 rounded-xl bg-slate-50 p-3 text-center">
                        <div><p className="text-[11px] text-slate-600">5日方向一致</p><p className="font-black">{percent(h.winRate)}</p></div>
                        <div><p className="text-[11px] text-slate-600">平均騰落</p><p className="font-black">{signed(h.meanReturn)}</p></div>
                        <div><p className="text-[11px] text-slate-600">最悪の終値比較</p><p className="font-black">{signed(h.worstReturn)}</p></div>
                      </div>
                      {h.completed < 20 && <p className="mt-2 text-xs font-bold text-amber-800">
                        検証20件未満：まだ優劣は判断しないでください。
                      </p>}
                    </article>
                  );
                })}
              </div>
            </section>
            <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
              <h2 className="font-black">保存履歴（最大50件）</h2>
              {runs.length === 0 ? (
                <p className="mt-3 text-sm text-slate-600">保存履歴はまだありません。まず5銘柄の研究結果を保存してみてね。</p>
              ) : runs.map(run => (
                <div key={run.id} className="mt-3 rounded-xl border border-slate-100 bg-slate-50 p-3 text-sm">
                  <p className="font-black">{run.batch_key}</p>
                  <p className="mt-1 text-xs text-slate-600">
                    {new Date(run.created_at).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" })}（日本時間）
                    ／取得 {run.succeeded_count}/{run.requested_count}銘柄
                  </p>
                  <p className="mt-1 text-xs text-slate-600">参考日足 {run.first_bar_date}〜{run.last_bar_date}</p>
                </div>
              ))}
            </section>
          </>
        )}
        <p className="mt-5 text-xs leading-6 text-slate-500">
          検出ロジックの条件を変更した場合は別バージョンとして検証する必要があります。
          研究値は将来の利益を保証せず、本番の売買判断に自動反映されません。
        </p>
      </div>
      <BottomNav/>
    </main>
  );
}
