import Link from "next/link";
import { notFound } from "next/navigation";
import BottomNav from "@/app/components/BottomNav";
import { getLearningOwnerSession } from "@/app/lib/learningOwner";
import pool from "@/app/lib/postgres";
import {
  analyzePrecloseStudy, type PrecloseObservation, type PrecloseStats,
} from "@/app/lib/research/precloseCandidateStudy";
import { comparePrecloseBudgets } from "@/app/lib/research/precloseBudgetComparison";
import {
  compareMatchedTimeByExclusiveBand, summarizeExclusivePrecloseBands,
  type PrecloseMatchedTimePair,
} from "@/app/lib/research/precloseDisjointTimeStudy";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type ObservationDbRow = {
  trade_date: string; outcome_date: string; code: string; name: string;
  entry_price: number | string; ai_power: number | string | null;
  sampled_at: string; outcome_price: number | string | null;
};

const integer = (value: number) => value.toLocaleString("ja-JP");
const yen = (value: number | null) => value === null ? "—"
  : (value > 0 ? "+" : "") + Math.round(value).toLocaleString("ja-JP") + "円";
const price = (value: number) => value.toLocaleString("ja-JP", {maximumFractionDigits: 2}) + "円";
const pct = (value: number | null) => value === null ? "—"
  : (value > 0 ? "+" : "") + value.toFixed(2) + "%";
const winPct = (value: number | null) => value === null ? "—" : value.toFixed(1) + "%";

function todayJst() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date());
}

async function loadObservations(): Promise<PrecloseObservation[]> {
  // Observational records only. Never refresh the scan or call a market-data API.
  const query = [
    "SELECT o.trade_date::text AS trade_date, o.outcome_date::text AS outcome_date,",
    "  o.code, o.name, o.entry_price, o.ai_power, o.sampled_at::text AS sampled_at,",
    "  CASE WHEN d.price > 0 THEN d.price ELSE NULL END AS outcome_price",
    "FROM public.golden_zone_observations AS o",
    "LEFT JOIN public.daily_stock_results AS d",
    "  ON d.date = o.outcome_date::text AND d.code = o.code",
    "WHERE o.time_slot = '15:15'",
    "  AND o.trade_date >= ((NOW() AT TIME ZONE 'Asia/Tokyo')::date - INTERVAL '240 days')",
    "ORDER BY o.trade_date DESC, o.code ASC",
    "LIMIT 7200",
  ].join("\n");
  const result = await pool.query<ObservationDbRow>(query);
  return result.rows.map((row) => ({
    tradeDate: row.trade_date,
    outcomeDate: row.outcome_date,
    code: row.code,
    name: row.name,
    entryPrice: Number(row.entry_price),
    aiPower: row.ai_power === null ? null : Number(row.ai_power),
    sampledAt: row.sampled_at,
    outcomePrice: row.outcome_price === null ? null : Number(row.outcome_price),
  }));
}

type MatchedDbRow = {
  trade_date: string; code: string; time_slot: string;
  preclose_price: number | string; earlier_price: number | string;
  preclose_ai: number | string | null; earlier_ai: number | string | null;
  outcome_price: number | string;
};

async function loadPrecloseMatchedRows(): Promise<PrecloseMatchedTimePair[]> {
  // Same-code same-day only, both timestamps tested against one saved next-day reference price.
  // Last 60 calendar days caps scan volume. This is NOT a second scan or a write.
  const sql = [
    "SELECT p.trade_date::text AS trade_date, p.code, e.time_slot,",
    "  p.entry_price AS preclose_price, e.entry_price AS earlier_price,",
    "  p.ai_power AS preclose_ai, e.ai_power AS earlier_ai,",
    "  d.price AS outcome_price",
    "FROM public.golden_zone_observations AS p",
    "JOIN public.golden_zone_observations AS e",
    "  ON e.trade_date = p.trade_date AND e.code = p.code",
    "  AND e.outcome_date = p.outcome_date AND e.time_slot <> '15:15'",
    "JOIN public.daily_stock_results AS d",
    "  ON d.date = p.outcome_date::text AND d.code = p.code",
    "WHERE p.time_slot = '15:15'",
    "  AND e.time_slot IN ('09:15','09:30','10:30','12:40','13:00','14:30')",
    "  AND p.ai_power >= 90 AND e.ai_power >= 90",
    "  AND p.entry_price > 0 AND e.entry_price > 0 AND d.price > 0",
    "  AND p.trade_date >= ((NOW() AT TIME ZONE 'Asia/Tokyo')::date - INTERVAL '60 days')",
    "  AND p.trade_date < (NOW() AT TIME ZONE 'Asia/Tokyo')::date",
    "  AND p.outcome_date <= (NOW() AT TIME ZONE 'Asia/Tokyo')::date",
    "ORDER BY p.trade_date DESC, p.code, e.time_slot",
    "LIMIT 12000",
  ].join("\n");
  const response = await pool.query<MatchedDbRow>(sql);
  return response.rows.map((r) => ({
    tradeDate: r.trade_date, code: r.code, slot: r.time_slot,
    preclosePrice: Number(r.preclose_price),
    earlierPrice: Number(r.earlier_price),
    precloseAi: r.preclose_ai === null ? null : Number(r.preclose_ai),
    earlierAi: r.earlier_ai === null ? null : Number(r.earlier_ai),
    outcomePrice: Number(r.outcome_price),
  }));
}

function StatsBlock({ title, stats }: { title: string; stats: PrecloseStats }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
      <p className="text-sm font-black">{title}</p>
      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
        {stats.observedDays}営業日 / {stats.samples}件判定 / WIN {stats.wins}・LOSE {stats.losses}・HOLD {stats.holds}
      </p>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <p className="text-xs">±2%勝率 <b className="block text-base">{winPct(stats.winRate)}</b></p>
        <p className="text-xs">平均騰落 <b className="block text-base">{pct(stats.meanChangePct)}</b></p>
        <p className="text-xs">100株平均損益 <b className="block text-base">{yen(stats.meanPnl100)}</b></p>
        <p className="text-xs">最悪の騰落 <b className="block text-base">{pct(stats.worstChangePct)}</b></p>
      </div>
    </div>
  );
}

export default async function PrecloseCandidatesPage() {
  const { isOwner } = await getLearningOwnerSession();
  if (!isOwner) notFound();

  // Independent read requests: a comparison-query failure never hides the original study.
  const [observationQuery, matchedQuery] = await Promise.allSettled([
    loadObservations(), loadPrecloseMatchedRows(),
  ]);
  const error = observationQuery.status === "rejected";
  const matchedError = matchedQuery.status === "rejected";
  if (error) console.error("[preclose-candidates] read-only observations unavailable", observationQuery.reason);
  if (matchedError) console.error("[preclose-candidates] matching comparison unavailable", matchedQuery.reason);
  const observations: PrecloseObservation[] = observationQuery.status === "fulfilled" ? observationQuery.value : [];
  const matched: PrecloseMatchedTimePair[] = matchedQuery.status === "fulfilled" ? matchedQuery.value : [];

  const result = analyzePrecloseStudy(observations, todayJst());
  const { policy, training, validation, baseline } = result;
  const status = error ? "取得エラー" : result.phase === "COLLECTING"
    ? "検証データ収集中" : result.phase === "REFERENCE_PASSED"
      ? "固定条件の参考基準を通過" : "固定条件は基準未達";
  const todayRows = result.researchCandidates;
  const budgetComparisons = error ? [] : comparePrecloseBudgets(observations, result.date);
  const exclusiveBands = error ? [] : summarizeExclusivePrecloseBands(observations, result.date);
  const matchedBands = matchedError ? [] : compareMatchedTimeByExclusiveBand(matched, result.date);

  return (
    <main className="min-h-screen bg-slate-50 pb-28 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <div className="mx-auto max-w-3xl px-3 py-5">
        <Link href="/admin/learning-hub" className="text-sm font-bold text-blue-600 dark:text-blue-400">← 学習管理室へ</Link>
        <header className="mt-4 rounded-2xl border border-indigo-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
          <p className="text-[11px] font-black tracking-widest text-indigo-600">PRIVATE / PRE-CLOSE SHADOW RESEARCH</p>
          <h1 className="mt-1 text-2xl font-black">⏰ 15:15実証候補</h1>
          <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
            15:15枠の保存データを使い、翌営業日の参考株価で検証する本人専用ページです。
            売買注文・AI POWER・既存通知は変更しません。
          </p>
          <div className="mt-3 rounded-lg bg-indigo-50 px-3 py-2 text-sm font-bold text-indigo-800 dark:bg-indigo-950 dark:text-indigo-200">
            現在：{status}
          </div>
          {error ? <p role="alert" className="mt-2 text-sm font-bold text-red-600">観測データを読み込めませんでした。空欄は0件の証拠ではありません。</p> : null}
        </header>

        <section className="mt-4 rounded-2xl border border-emerald-200 bg-white p-4 dark:border-emerald-900 dark:bg-slate-900">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-lg font-black">🏅 本日の条件クリア銘柄</h2>
            <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-bold dark:bg-slate-800">
              {error ? "取得不可" : integer(result.verifiedCandidates.length) + "件"}
            </span>
          </div>
          {result.verifiedCandidates.length === 0 ? (
            <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">
              現在、固定条件を満たすと確認できた銘柄はありません。過去の少数日の好成績だけで「実証済み」にしません。
            </p>
          ) : (
            <div className="mt-3 space-y-2">
              {result.verifiedCandidates.map((row) => (
                <div key={row.code} className="rounded-xl border border-emerald-200 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <b>{row.name}（{row.code}）</b>
                    <span className="text-xs font-bold text-emerald-600">参考条件一致</span>
                  </div>
                  <p className="mt-1 text-sm">観測価格 {price(row.entryPrice)} / 100株 {price(row.entryPrice * 100)} / AI {row.aiPower ?? "—"}</p>
                  <Link href={"/chart/" + row.code} className="mt-2 inline-block rounded-lg border border-indigo-200 px-3 py-2 text-sm font-bold text-indigo-700">チャートを見る →</Link>
                </div>
              ))}
            </div>
          )}
          <p className="mt-2 text-xs leading-5 text-slate-500 dark:text-slate-400">
            「参考条件一致」は利益保証や買い推奨ではありません。翌日寄り付きの急変動・約定価格差などは別途考慮が必要です。
          </p>
        </section>

        <section id="preclose-budgets" className="mt-4 rounded-2xl border border-sky-200 bg-white p-4 dark:border-sky-900 dark:bg-slate-900">
          <h2 className="text-lg font-black">💴 購入予算別・15:15研究比較</h2>
          <p className="mt-2 text-xs leading-6 text-slate-600 dark:text-slate-300">
            10万円・30万円・50万円・100万円の予算内で「100株を買うと仮定できる銘柄」だけを比較します。
            15:15の保存価格×100株で判定し、AI POWER {policy.minAiPower}以上の候補を対象にした参考成績です。
          </p>
          <p className="mt-1 text-xs leading-5 text-amber-700 dark:text-amber-300">
            ※ 下記は正式な実証条件とは別の探索的な比較です。2026-10-16より前の参考履歴も含み、
            成績の良い予算帯を後から選んで実証済みとは扱いません。
          </p>
          {error ? <p className="mt-3 text-sm text-red-600" role="alert">取得エラーのため予算比較は表示できません。</p> : null}
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {budgetComparisons.map((entry) => (
              <div key={entry.budgetYen} className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-lg font-black">{integer(entry.budgetYen / 10000)}万円以内</h3>
                  <span className="text-xs font-bold text-indigo-700 dark:text-indigo-300">
                    今日の研究候補 {entry.researchCandidates.length}件
                  </span>
                </div>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-300">
                  今日の全30銘柄中・予算内 {entry.eligibleObservedToday}件 / AI {policy.minAiPower}以上 {entry.researchCandidates.length}件
                </p>
                <div className="mt-2 grid grid-cols-2 gap-x-2 gap-y-2 text-xs">
                  <div>参考判定数 <b className="block text-sm">{entry.reference.samples}件 / {entry.reference.observedDays}日</b></div>
                  <div>±2%勝率 <b className="block text-sm">{winPct(entry.reference.winRate)}</b></div>
                  <div>利益プラス率 <b className="block text-sm">{winPct(entry.referenceProfitableRate)}</b></div>
                  <div>翌日平均騰落 <b className="block text-sm">{pct(entry.reference.meanChangePct)}</b></div>
                  <div>100株平均損益 <b className="block text-sm">{yen(entry.reference.meanPnl100)}</b></div>
                  <div>100株最悪例 <b className="block text-sm">{yen(entry.worstPnl100)}</b></div>
                </div>
                <p className="mt-2 text-[11px] text-slate-500 dark:text-slate-300">
                  WIN {entry.reference.wins} / LOSE {entry.reference.losses} / HOLD {entry.reference.holds}（±2%勝率はHOLD除外）
                </p>
                <details className="mt-3 rounded-lg border border-slate-200 bg-white px-3 py-2 dark:border-slate-600 dark:bg-slate-900">
                  <summary className="cursor-pointer text-sm font-bold">
                    今日の予算内候補を見る（{entry.researchCandidates.length}件）
                  </summary>
                  {entry.researchCandidates.length === 0 ? (
                    <p className="mt-2 text-xs text-slate-500">該当候補なし。研究データ収集中です。</p>
                  ) : (
                    <div className="mt-2 space-y-2">
                      {entry.researchCandidates.map((row) => (
                        <div key={row.tradeDate + row.code} className="border-t border-slate-100 pt-2 text-xs dark:border-slate-700">
                          <p className="font-bold">{row.name}（{row.code}） / AI {row.aiPower ?? "—"}</p>
                          <p className="mt-1 text-slate-500 dark:text-slate-300">15:15保存価格 {price(row.entryPrice)} ・100株 {price(row.entryPrice * 100)}</p>
                          <div className="mt-1 flex gap-3">
                            <Link className="font-bold text-blue-600 dark:text-blue-400" href={"/chart/" + row.code}>チャート →</Link>
                            <Link className="font-bold text-blue-600 dark:text-blue-400" href={"/analysis/" + row.code}>分析 →</Link>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </details>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs leading-5 text-slate-500 dark:text-slate-400">
            参考比較は前営業日以前の15:15観測と翌営業日の保存価格から計算。
            100株換算の平均損益は「1銘柄を100株保有した仮の損益」で、予算総額を投資した成績ではありません。
            取引コスト・税金・スリッページは含みません。
            株式以外（J-REIT・ETFなど）は実際の売買単位が100株と異なるため、購入可否は別途確認が必要です。
            予算帯同士は対象銘柄が重複し、少数日の比較に優劣の確証はありません。
          </p>
        </section>

        <section id="preclose-exclusive-bands" className="mt-4 rounded-2xl border border-indigo-200 bg-white p-4 dark:border-indigo-900 dark:bg-slate-900">
          <h2 className="text-lg font-black">🧩 重複なし・購入金額帯別の比較</h2>
          <p className="mt-2 text-xs leading-5 text-slate-600 dark:text-slate-300">
            既存の「〇万円以内」と違い、同じ観測銘柄は<strong>4区分のうち1つだけ</strong>に入ります。
            15:15の参考価格×100株を基準にし、AI POWER {policy.minAiPower}以上の銘柄を比較します。
          </p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {exclusiveBands.map((band) => (
              <div key={band.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800">
                <div className="flex flex-wrap items-baseline justify-between gap-1">
                  <h3 className="text-sm font-black">{band.label}</h3>
                  <span className="text-xs text-indigo-700 dark:text-indigo-300">今日 {band.todayCount}件</span>
                </div>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">翌日価格判定済み {band.stats.samples}件 / {band.stats.observedDays}日</p>
                <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                  <p>利益プラス率 <b className="block text-base">{winPct(band.positivePct)}</b></p>
                  <p>±2%勝率 <b className="block text-base">{winPct(band.stats.winRate)}</b></p>
                  <p>平均騰落 <b className="block text-base">{pct(band.stats.meanChangePct)}</b></p>
                  <p>100株平均損益 <b className="block text-base">{yen(band.stats.meanPnl100)}</b></p>
                </div>
                <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">100株最悪例 {yen(band.worst100)}
                  ・WIN {band.stats.wins} / LOSE {band.stats.losses} / HOLD {band.stats.holds}</p>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs leading-5 text-slate-500 dark:text-slate-400">
            全データは探索的な参考比較で、10月16日より前の履歴も含みます。
            金額帯ごとの母数が違うため順位づけはせず、100株換算は実際の取引単位とは異なる場合があります。
          </p>
        </section>

        <section id="preclose-matched-times" className="mt-4 rounded-2xl border border-violet-200 bg-white p-4 dark:border-violet-900 dark:bg-slate-900">
          <h2 className="text-lg font-black">🕰️ 15:15 vs 他の6時刻・同じ銘柄で比較</h2>
          <p className="mt-2 text-xs leading-6 text-slate-600 dark:text-slate-300">
            同じ日・同じ銘柄が両時刻に観測され、両方でAI POWER {policy.minAiPower}以上、
            さらに100株参考価格が同じ金額帯に属する場合だけ比較します。
            共通の翌営業日保存価格に対して、各時刻の観測価格から計算した平均騰落率を表示します。
          </p>
          <p className="mt-2 text-xs leading-5 text-amber-700 dark:text-amber-300">
            直近60暦日の参考比較。15:15の候補を朝から買えたことにはせず、未来情報を使った売買シミュレーションでもありません。
            両時刻に残った同じ銘柄だけの比較なので、時間帯の優劣はこれだけでは確定しません。
          </p>
          {matchedError ? <p role="alert" className="mt-2 text-sm font-bold text-red-600">時刻比較の取得に失敗しました。0件と誤認しないため結果を非表示にしています。</p> : null}
          {!matchedError && matchedBands.map((band) => (
            <details key={band.bandId} className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800">
              <summary className="cursor-pointer text-sm font-black">{band.label}（15:15との比較を開く）</summary>
              <div className="mt-3 space-y-2">
                {band.slots.map((slot) => (
                  <div key={slot.slot} className="rounded-lg border border-slate-200 bg-white p-2 text-xs dark:border-slate-700 dark:bg-slate-900">
                    <div className="flex flex-wrap justify-between gap-2">
                      <b>{slot.slot} vs 15:15</b>
                      <span className="text-slate-500 dark:text-slate-400">同銘柄ペア {slot.matched}件 / {slot.observedDays}日</span>
                    </div>
                    <div className="mt-1 grid grid-cols-2 gap-2 sm:grid-cols-3">
                      <p>{slot.slot}で観測 <b className="block">{pct(slot.earlierMeanPct)}</b></p>
                      <p>15:15で観測 <b className="block">{pct(slot.precloseMeanPct)}</b></p>
                      <p>15:15−比較時刻 <b className="block">{slot.differencePctPoints === null ? "—" :
                        (slot.differencePctPoints > 0 ? "+" : "") + slot.differencePctPoints.toFixed(2) + "pt"}</b></p>
                    </div>
                    <p className="mt-1 text-slate-500 dark:text-slate-400">
                      ±2%勝率 {slot.slot} {winPct(slot.earlierWinRate)} / 15:15 {winPct(slot.precloseWinRate)}（HOLD除外）
                    </p>
                  </div>
                ))}
              </div>
            </details>
          ))}
          {!matchedError && matched.length === 0 ? <p className="mt-3 text-xs">比較できる同銘柄ペアはまだありません。</p> : null}
          <p className="mt-3 text-xs leading-5 text-slate-500 dark:text-slate-400">
            各時刻の銘柄上位30件は変動するため、同じ銘柄が両時刻にある場合だけの条件付き分析。
            取引コスト・税金・約定価格・大引けの特別気配などは反映しません。
            実証判定・LINE通知・売買・既存の学習データには反映しない研究専用です。
          </p>
        </section>

        <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
          <h2 className="text-lg font-black">📋 研究中の観測銘柄</h2>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {result.date} の15:15枠 / 保存 {result.todaySaved}件 / AI POWER {policy.minAiPower}以上 {todayRows.length}件
          </p>
          {todayRows.length === 0 ? (
            <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">
              本日の保存候補はありません。観測時刻前、休場日、または保存されなかった可能性があります。
            </p>
          ) : (
            <div className="mt-3 space-y-1.5">
              {todayRows.map((row) => (
                <details key={row.code} className="rounded-lg border border-slate-200 px-3 py-2 dark:border-slate-700">
                  <summary className="cursor-pointer text-sm font-bold">
                    {row.name}（{row.code}） <span className="ml-1 text-xs font-normal text-slate-500">AI {row.aiPower ?? "—"}</span>
                  </summary>
                  <div className="mt-2 text-sm">
                    <p>15:15枠の保存価格：{price(row.entryPrice)}</p>
                    <p>100株の参考金額：{price(row.entryPrice * 100)}</p>
                    <p className="mt-1 text-xs text-slate-500">条件検証中・買いサインではありません。</p>
                    <div className="mt-2 flex gap-3">
                      <Link href={"/chart/" + row.code} className="font-bold text-blue-600">チャート →</Link>
                      <Link href={"/analysis/" + row.code} className="font-bold text-blue-600">銘柄分析 →</Link>
                    </div>
                  </div>
                </details>
              ))}
            </div>
          )}
        </section>

        <section className="mt-4 space-y-3">
          <h2 className="text-lg font-black">📊 固定条件の答え合わせ</h2>
          <p className="text-xs leading-5 text-slate-600 dark:text-slate-300">
            仮説：15:15枠でAI POWER {policy.minAiPower}以上。過去の結果を時系列で分け、
            先の期間と後の10営業日の両方で成績を検証。
            正式な合格判定は{policy.prospectiveStartDate}以降の新しい観測だけを使います。
            それ以前の結果は参考履歴に留め、今日の翌日結果も判定に使用しません。
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            <StatsBlock title="① 過去の学習期間" stats={training}/>
            <StatsBlock title="② 後半10営業日の別期間" stats={validation}/>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-3 text-sm dark:border-slate-700 dark:bg-slate-900">
            <b>同じ後半期間の15:15上位銘柄全体との比較</b>
            <p className="mt-1 text-xs">全体の平均騰落 {pct(baseline.meanChangePct)} / 固定条件の上乗せ {pct(result.improvement)}</p>
            <p className="mt-2 text-xs leading-5 text-slate-500">
              ±2%勝率はHOLDを除外。損益は100株換算で取引費用・税金なし。
              条件判定では売買時の価格差等の仮定として平均騰落から{policy.assumedRoundTripCostPct.toFixed(1)}ポイント差し引きます。
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
            <h3 className="text-sm font-black">実証のための最低データ量</h3>
            <div className="mt-2 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
              {result.needs.map((need) => (
                <p key={need.name} className="text-xs text-slate-600 dark:text-slate-300">
                  {need.current >= need.min ? "✓" : "○"} {need.name}：{need.current}/{need.min}
                </p>
              ))}
            </div>
            <p className="mt-3 text-xs leading-6 text-slate-500">
              さらに両期間の±2%勝率60%以上、別期間の想定コスト控除後平均騰落がプラス、
              同期間の全体平均より0.3ポイント以上改善、別期間の最悪例が-10%未満にならないことを確認します。
              数値は研究用の事前固定基準で、統計学的に有効性が証明されたことを意味しません。
            </p>
          </div>
        </section>

        <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
          <details>
            <summary className="cursor-pointer font-black">🧾 過去の観測結果（直近30件）</summary>
            <div className="mt-3 space-y-2">
              {result.history.length === 0 ? <p className="text-sm">翌営業日の参考価格はまだありません。</p> : null}
              {result.history.map((row) => {
                const delta = ((row.outcomePrice as number) - row.entryPrice) / row.entryPrice * 100;
                const status = delta >= 2 ? "WIN" : delta <= -2 ? "LOSE" : "HOLD";
                return <div key={row.tradeDate + ":" + row.code} className="rounded-lg bg-slate-50 p-2 text-xs dark:bg-slate-800">
                  <div className="flex flex-wrap justify-between gap-1">
                    <b>{row.tradeDate} {row.name}（{row.code}）</b>
                    <b>{status} / {pct(delta)}</b>
                  </div>
                  <p className="mt-1 text-slate-500 dark:text-slate-400">
                    観測 {price(row.entryPrice)} → 翌日参考 {price(row.outcomePrice as number)}
                    ・100株 {yen(((row.outcomePrice as number) - row.entryPrice) * 100)}
                  </p>
                </div>;
              })}
            </div>
          </details>
        </section>

        <p className="mt-4 text-xs leading-6 text-slate-500 dark:text-slate-400">
          ⚠️ データはAI上位30銘柄からの観測で、無作為抽出ではありません。
          価格は約定可能価格・公式終値と一致する保証がなく、同じ銘柄の反復観測も独立した試行ではありません。
          出来高・ローソク足形状は現状の15:15保存項目にないため、未検証です。
          実売買は行わず、通知も送信しません。
        </p>
        <div className="mt-3">
          <Link href="/admin/golden-zone" className="text-sm font-bold text-blue-600 dark:text-blue-400">← 曜日・時間帯ゴールデンゾーンを見る</Link>
        </div>
      </div>
      <BottomNav />
    </main>
  );
}
