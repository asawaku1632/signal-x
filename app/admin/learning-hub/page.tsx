import Link from "next/link";
import pool from "@/app/lib/postgres";
import { isTseTargetDateReady, resolveTseTradingDatesAfter } from "@/app/lib/technicalObservation/tseMarketCalendar";
import { notFound } from "next/navigation";
import BottomNav from "@/app/components/BottomNav";
import { getLearningOwnerSession } from "@/app/lib/learningOwner";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type HubItem = { href: string; icon: string; title: string; detail: string; tag?: string };
const sections: { id: string; title: string; subtitle: string; items: HubItem[] }[] = [
  {
    id: "verification", title: "① 売買判断の答え合わせ",
    subtitle: "当たりも外れも、その後の株価で確かめる",
    items: [
      {
        href: "/admin/post-sale-audit", icon: "📈",
        title: "実売却後の1・3・5営業日追跡", tag: "本人専用・自動研究",
        detail: "確定売買を手入力して、売却後の参考株価を引け後に自動追跡",
      },
      {
        href: "/simulation/conflict-check", icon: "🟣",
        title: "爆益前兆 × 撤退候補", tag: "新機能",
        detail: "矛盾する2つのシグナルを3・5・10取引日後に比較",
      },
      {
        href: "/simulation/exit-check", icon: "🔴",
        title: "撤退後の反発・続落",
        detail: "疑似保有の撤退候補が正しかったかを検証",
      },
      {
        href: "/simulation/universe-check", icon: "📊",
        title: "全銘柄スイング検証",
        detail: "疑似購入なしで1・3・5・10取引日の株価を比較",
      },
      {
        href: "/admin/stock-win-rate-ranking", icon: "🏆",
        title: "全銘柄・勝敗ランキング", tag: "管理者専用",
        detail: "WIN・LOSE・勝率を全期間／直近30件で比較、母数で絞り込み",
      },
      {
        href: "/admin/ai-win-rate-audit", icon: "🎯",
        title: "AI勝率の信頼性監査",
        detail: "勝率の内訳と古いデータの限界を確認",
      },
    ],
  },
  {
    id: "research", title: "② 爆益前兆・研究モデル",
    subtitle: "どんな条件のときに上がりやすいか探す",
    items: [
      { href: "/admin/downtrend-watch", icon: "📉", title: "お気に入りの下落傾向通知", tag: "本人専用", detail: "終値・高値切り下がりとBB・出来高を確認して通知" },
      { href: "/admin/uptrend-watch", icon: "📈", title: "上昇傾向の通知", tag: "本人専用", detail: "前日までの形状を場中に確認し、上昇条件が揃った銘柄を通知" },
      {
        href: "/admin/research-allstars", icon: "🏆",
        title: "研究オールスター", tag: "本人専用・厳選研究",
        detail: "全研究の前向き成績を点検し、別期間でも再現した法則だけを自動選抜",
      },
      {
        href: "/admin/crash-strength", icon: "📉",
        title: "暴落後・強弱ランキング", tag: "本人専用・読み取り研究",
        detail: "急落時の市場比ランキングと翌日・3日・5保存日後の事後検証",
      },
      {
        href: "/admin/dual-surge-shadow", icon: "🚀",
        title: "急騰前兆・急騰開始の独立研究", tag: "本人専用・研究用",
        detail: "急騰前の兆候と急騰開始を別々に検証。未収集・未検証の成績は表示しません",
      },
      {
        href: "/admin/explosive-watch", icon: "🚀",
        title: "爆上げ候補ウォッチ",
        detail: "候補銘柄の前兆と未来追跡をまとめて確認",
      },
      {
        href: "/admin/research-lab", icon: "⛏️",
        title: "鉱脈研究所",
        detail: "4つの研究モデルの成績と重なりを比較",
      },
      {
        href: "/admin/momentum-memory", icon: "🧠",
        title: "爆益前兆（Momentum Memory）",
        detail: "前兆通知後の実績と検証ステータス",
      },
      {
        href: "/admin/ai-judgment-stability", icon: "🔁",
        title: "AI判定の揺れ・安定性研究", tag: "研究用",
        detail: "買い候補→見送りなどAI評価帯の変化回数と翌営業日の成績を比較",
      },
      {
        href: "/admin/weak-ai-rebound", icon: "🔬",
        title: "弱いAI判定からの逆張り反発研究", tag: "本人専用・前向き検証",
        detail: "AI POWER55未満の5銘柄を前夜固定し、翌9:10参考価格から1・3・5・10日後を検証",
      },
      {
        href: "/admin/exit-timing-study", icon: "⏰",
        title: "朝9:10購入・4つの利確時刻研究", tag: "本人専用・自動検証",
        detail: "同じ前夜5銘柄を9:10に仮想購入し、9:30・10:00・11:30・大引けの損益と最大下落を比較",
      },
      {
        href: "/admin/morning-final-check", icon: "☀️",
        title: "朝9:05 最終チェック", tag: "本人専用・前夜5銘柄",
        detail: "前夜固定→9:05最初の5分足を確認→大引け後に答え合わせ（独立研究）",
      },
      {
        href: "/admin/night-entry-holding", icon: "🔬",
        title: "前夜候補・購入時間と1/3/5日後", tag: "本人専用・前向き研究",
        detail: "前夜に固定した同じ銘柄の9:00〜9:30と1・3・5営業日後を比較（参考価格）",
      },
      {
        href: "/admin/night-morning-watch", icon: "🌙",
        title: "翌朝9時・勝率重視候補", tag: "本人専用・前夜候補",
        detail: "前営業日のAI上位5銘柄と朝9:05→大引けの過去検証を比較（研究用）",
      },
      {
        href: "/admin/entry-time-shadow", icon: "🕰️",
        title: "時間帯別エントリー最適化", tag: "自動研究",
        detail: "前夜上位5候補を9:05〜14:00の6時点で仮想購入・同日終値を比較",
      },
      {
        href: "/admin/golden-zone", icon: "⏰",
        title: "曜日・時間帯ゴールデンゾーン",
        detail: "曜日別・時間帯別の傾向とサンプル数",
      },
      {
        href: "/admin/preclose-candidates", icon: "🌇",
        title: "15:15実証候補", tag: "本人専用・研究用",
        detail: "大引け前の研究候補と翌日結果を固定条件で検証。通知・売買なし",
      },
      {
        href: "/admin/support-rebound", icon: "🌱",
        title: "支持線反発・最大100銘柄研究", tag: "研究用",
        detail: "③と②の勝率・損失を20・100銘柄で比較、業種別・期間別も検証",
      },
      {
        href: "/admin/pattern-performance", icon: "📚",
        title: "チャートパターン実績",
        detail: "パターン別の的中率と未来追跡",
      },
      {
        href: "/admin/neckline-entry-risk", icon: "📉",
        title: "ネックライン購入時刻・損失の拡張研究", tag: "本人専用・15銘柄",
        detail: "3通りの仮購入時刻、最大下落、前後期間を確定日足で比較。自動保存・通知なし",
      },
      {
        href: "/admin/neckline-quality", icon: "🔵",
        title: "底①・底②・ネックライン検証", tag: "本人専用・読み取り研究",
        detail: "実際の確定日足で上抜け・失効・期限終了と3/5営業日後の事後成績を確認",
      },
      {
        href: "/admin/shape-precision-audit", icon: "🔬",
        title: "チャート55形状・検出精度監査", tag: "新機能",
        detail: "ダブルボトム過剰検出・信頼度分布とサンプルチャートを点検",
      },
      {
        href: "/admin/bollinger-breakout-shadow", icon: "📈",
        title: "ボリンジャーバンド・上抜け比較", tag: "手動研究",
        detail: "9984・3762の確定日足でスクイーズ後と通常の上抜けを比較（保存・通知なし）",
      },
      {
        href: "/admin/four-patterns-shadow", icon: "🔬",
        title: "4手法まとめて比較", tag: "本人専用・研究用",
        detail: "水平線リテスト・EMA収縮・安値切り上げ・業績押し目の独立研究。データ不足は未検証と表示",
      },
      {
        href: "/admin/horizontal-retest", icon: "📏",
        title: "水平線ブレイク・押し目検証", tag: "研究用",
        detail: "過去の日足で反発後の勝率・100株損益を隔離検証",
      },
      {
        href: "/admin/shadow-msb-ob-swing", icon: "🧭",
        title: "MSB・OB × 5日/25日線・出来高", tag: "研究用",
        detail: "同じ過去の日足を4条件で比較（保存なし・本人専用）",
      },
      {
        href: "/admin/shadow-candlestick-nine", icon: "🕯️",
        title: "ローソク足9種類・隔離研究", tag: "研究用",
        detail: "1銘柄の過去日足から9種類を検出し、1・3・5営業日後の方向一致を確認",
      },
      {
        href: "/admin/shadow-candlestick-nine/batch", icon: "📊",
        title: "ローソク足9種類・複数銘柄比較", tag: "研究用",
        detail: "最大5銘柄の方向一致率・平均騰落率・最悪の結果と期間別比較",
      },
      {
        href: "/admin/shadow-candlestick-nine/archive", icon: "💾",
        title: "ローソク足研究・保存履歴", tag: "研究用",
        detail: "明示的に保存した銘柄の重複を除いた成績と検証履歴",
      },
    ],
  },
  {
    id: "quality", title: "③ 学習・保存・品質",
    subtitle: "データが毎日きちんと蓄積されているか",
    items: [
      {
        href: "/admin/learning-status", icon: "💾",
        title: "日次学習・保存監視",
        detail: "保存件数、実行状況、エラーを確認",
      },
      {
        href: "/admin/evolution", icon: "🌱",
        title: "AI進化の履歴",
        detail: "学習による変化を時系列で確認",
      },
      {
        href: "/admin/daily-price-audit", icon: "🔎",
        title: "株価データの品質監査",
        detail: "表示価格と保存価格の差異などを調査",
      },
    ],
  },
];


const bbCohorts = [
  ["UPPER_TREND", "上側・継続"],
  ["UPPER_REVERSAL", "上側・反転警戒"],
  ["LOWER_REBOUND", "下側・反発"],
  ["UPPER_WATCH", "上側・監視"],
  ["NO_BB", "BB記録なし"],
  ["OTHER", "その他"],
] as const;

type BbResult = {
  cohort: string;
  candidates: number;
  completed: number;
  positive: number;
  mean: number | null;
  worst: number | null;
};

const formatReturn = (value: number | null) =>
  value === null ? "—" : `${value > 0 ? "+" : ""}${value.toFixed(2)}%`;


async function Momentum915Results() {
  try {
    const { rows: anchors } = await pool.query<{
      date: string; code: string; price: number | null; cohort: string;
    }>(`
      SELECT r.trade_date::text AS date, a.code, a.price,
        CASE WHEN e.side = 'LOWER_REBOUND' THEN 'LOWER_REBOUND'
             WHEN e.upper_regime IN ('UPPER_TREND', 'UPPER_REVERSAL', 'UPPER_WATCH') THEN e.upper_regime
             WHEN e.id IS NULL THEN 'NO_BB' ELSE 'OTHER' END AS cohort
      FROM public.entry_time_shadow_runs r
      CROSS JOIN LATERAL jsonb_to_recordset(r.results->0->'momentum915'->'anchors')
        AS a(code text, price float8)
      LEFT JOIN LATERAL (
        SELECT id, side, upper_regime FROM public.bb_signal_events
        WHERE code = a.code AND signal_date = r.prior_date
          AND created_at < ((r.trade_date + time '09:00') AT TIME ZONE 'Asia/Tokyo')
        ORDER BY created_at DESC, id DESC LIMIT 1
      ) e ON true
      WHERE r.results->0->'momentum915'->>'version' = 'MOMENTUM_0915_AFTER_CLOSE_V1'
    `);
    if (!anchors.length) return <p className="mt-2 text-xs text-slate-600">9:15の検証記録はまだありません。</p>;

    const horizons = [1, 3, 5];
    const now = new Date();
    const targets = anchors.flatMap(anchor => {
      const dates = resolveTseTradingDatesAfter(anchor.date, 5);
      return horizons.map(horizon => ({ ...anchor, horizon, target: dates[horizon - 1] }));
    });
    const { rows: prices } = await pool.query<{ date: string; code: string; price: string }>(`
      SELECT DISTINCT ON (date, code) date, code, price::text
      FROM public.daily_stock_results
      WHERE date = ANY($1::text[]) AND code = ANY($2::text[])
      ORDER BY date, code, created_at DESC, id DESC
    `, [[...new Set(targets.map(row => row.target))], [...new Set(anchors.map(row => row.code))]]);
    const byDateCode = new Map(prices.map(row => [row.date + ":" + row.code, Number(row.price)]));

    return (
      <div className="mt-4 border-t pt-3">
        <h3 className="text-xs font-black">翌営業日9:15基準・100株の事後検証</h3>
        <p className="mt-1 text-xs leading-5 text-slate-600">
          引け後取得の9:15足始値から、購入日の翌取引日を1日後として計算。出口は日次保存の参考価格。コスト控除前。
          BBは購入日9:00より前の最新記録で分類。
        </p>
        <div className="mt-2 overflow-x-auto">
          <table className="w-full whitespace-nowrap text-xs tabular-nums">
            <caption className="sr-only">BB判定別の100株損益</caption>
            <thead><tr className="border-b text-right">
              <th scope="col" className="text-left">BB判定</th><th scope="col">日後</th>
              <th scope="col">完了</th><th scope="col">待ち</th><th scope="col">欠損</th><th scope="col">平均損益</th>
            </tr></thead>
            <tbody>
              {bbCohorts.filter(([key]) => anchors.some(row => row.cohort === key)).flatMap(([key, label]) =>
                horizons.map(horizon => {
                  const rows = targets.filter(row => row.cohort === key && row.horizon === horizon);
                  let waiting = 0;
                  let missing = 0;
                  const pnl: number[] = [];
                  for (const row of rows) {
                    const exit = byDateCode.get(row.target + ":" + row.code);
                    if (row.price === null || !Number.isFinite(row.price) || row.price <= 0) missing++;
                    else if (!isTseTargetDateReady(row.target, now)) waiting++;
                    else if (exit === undefined || !Number.isFinite(exit) || exit <= 0) missing++;
                    else pnl.push((exit - row.price) * 100);
                  }
                  const mean = pnl.length ? Math.round(pnl.reduce((sum, value) => sum + value, 0) / pnl.length) : null;
                  return <tr key={key + horizon} className="border-b border-slate-100 text-right">
                    <th scope="row" className="py-1 text-left">{label}</th><td>{horizon}</td>
                    <td>{pnl.length}</td><td>{waiting}</td><td>{missing}</td>
                    <td>{mean === null ? "—" : (mean > 0 ? "+" : "") + mean.toLocaleString("ja-JP") + "円"}</td>
                  </tr>;
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  } catch (error) {
    console.error("Momentum 09:15 outcomes unavailable", error);
    return <p role="status" className="mt-2 text-xs text-slate-600">9:15の損益集計を取得できませんでした。</p>;
  }
}

async function MomentumBbComparison() {
  let results: BbResult[];
  try {
    const { rows } = await pool.query<BbResult>(`
WITH candidates AS (
  SELECT DISTINCT ON (trade_date, code) trade_date, code, result_5d
  FROM public.momentum_memory_observations
  WHERE observation_flag AND validation_mode = 'FORWARD'
    AND created_at < ((trade_date + 1 + time '09:15') AT TIME ZONE 'Asia/Tokyo')
  ORDER BY trade_date, code, created_at, id
), classified AS (
  SELECT m.*, CASE
    WHEN e.side = 'LOWER_REBOUND' THEN 'LOWER_REBOUND'
    WHEN e.upper_regime IN ('UPPER_TREND', 'UPPER_REVERSAL', 'UPPER_WATCH') THEN e.upper_regime
    WHEN e.id IS NULL THEN 'NO_BB'
    ELSE 'OTHER'
  END AS cohort
  FROM candidates m
  LEFT JOIN LATERAL (
    SELECT id, side, upper_regime
    FROM public.bb_signal_events
    WHERE code = m.code AND signal_date = m.trade_date
      AND created_at < ((m.trade_date + 1 + time '09:15') AT TIME ZONE 'Asia/Tokyo')
    ORDER BY created_at DESC, id DESC
    LIMIT 1
  ) e ON true
)
SELECT cohort, count(*)::int AS candidates, count(result_5d)::int AS completed,
       count(*) FILTER (WHERE result_5d > 0)::int AS positive,
       avg(result_5d)::float8 AS mean, min(result_5d)::float8 AS worst
FROM classified GROUP BY cohort
    `);
    results = rows;
  } catch (error) {
    console.error("Momentum BB research comparison failed", error);
    return <p role="status" className="mt-3 text-xs text-slate-600">爆益前兆 × BBの比較を取得できませんでした。</p>;
  }
  const byCohort = new Map(results.map(row => [row.cohort, row]));

  return (
    <section aria-labelledby="momentum-bb-title" className="mt-3 rounded-2xl border border-indigo-100 bg-white p-3">
      <h2 id="momentum-bb-title" className="text-sm font-black">爆益前兆 × ボリンジャーバンド</h2>
      <p className="mt-1 text-xs leading-5 text-slate-600">
        前向き候補を銘柄・判定日ごとに集計。同日のBB記録のうち、翌暦日9:15（日本時間）より前に保存された最新判定を使用。
      </p>
      <div className="mt-2 overflow-x-auto">
        <table className="w-full whitespace-nowrap text-xs tabular-nums">
          <caption className="sr-only">BB判定別の保存済み5営業日後成績</caption>
          <thead>
            <tr className="border-b text-right text-slate-600">
              <th scope="col" className="py-2 text-left">BB判定</th>
              <th scope="col">完了 / 成立</th>
              <th scope="col">プラス</th>
              <th scope="col">平均</th>
              <th scope="col">最悪</th>
            </tr>
          </thead>
          <tbody>
            {bbCohorts.map(([key, label]) => {
              const row = byCohort.get(key);
              return (
                <tr key={key} className="border-b border-slate-100 text-right">
                  <th scope="row" className="py-2 pr-2 text-left font-bold">{label}</th>
                  <td>{row?.completed ?? 0} / {row?.candidates ?? 0}</td>
                  <td>{row?.completed ? `${row.positive}/${row.completed}` : "—"}</td>
                  <td>{formatReturn(row?.mean ?? null)}</td>
                  <td>{formatReturn(row?.worst ?? null)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs leading-5 text-slate-600">
        表は既存の5営業日後騰落率。9:15を起点にした結果は下の事後検証で確認できます。
      </p>
      <Momentum915Results />
    </section>
  );
}

export default async function PrivateLearningHubPage() {
  const { isOwner } = await getLearningOwnerSession();
  if (!isOwner) notFound();

  return (
    <main className="min-h-screen bg-slate-50 pb-28 text-slate-900">
      <div className="mx-auto max-w-2xl px-3 pt-4 sm:px-5">
        <div className="flex items-center justify-between gap-2">
          <Link href="/menu" className="text-xs font-black text-blue-600">← メニュー</Link>
          <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-bold text-slate-600">
            🔒 本人専用
          </span>
        </div>
        <header className="mt-4 rounded-2xl border border-indigo-100 bg-white px-4 py-5 shadow-sm">
          <p className="text-[10px] font-black tracking-widest text-indigo-600">SIGNALX PRIVATE RESEARCH</p>
          <h1 className="mt-1 text-2xl font-black">🧠 学習データ・管理室</h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            AIの予測、その後の結果、保存・学習状況をここからまとめて確認できます。
          </p>
          <p className="mt-2 text-[11px] leading-5 text-slate-500">
            これは管理・検証用の入口です。予測結果の有効性や利益を保証しません。
          </p>
        </header>

        <Link href="/admin/research-allstars"
          className="mt-3 block rounded-2xl border border-amber-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-black text-amber-900">🏆 SIGNALX 研究オールスター</p>
          <p className="mt-1 text-sm font-bold text-slate-700">
            日々の研究から、検証条件に合格した法則だけを厳選する →
          </p>
          <p className="mt-1 text-[11px] text-slate-500">
            別期間での再確認まで求める研究専用ランキング。売買推奨ではありません。
          </p>
        </Link>
        <MomentumBbComparison />
        <nav aria-label="学習データの分類" className="mt-3 grid grid-cols-3 gap-2">
          {[
            { href: "#verification", label: "📈 答え合わせ" },
            { href: "#research", label: "🚀 研究" },
            { href: "#quality", label: "💾 保存・品質" },
          ].map((item) => (
            <a key={item.href} href={item.href}
              className="rounded-xl border border-slate-200 bg-white px-1 py-3 text-center text-xs font-black text-slate-700">
              {item.label}
            </a>
          ))}
        </nav>

        {sections.map((section) => (
          <section id={section.id} key={section.id} className="mt-6 scroll-mt-4">
            <h2 className="text-base font-black">{section.title}</h2>
            <p className="mt-1 text-xs text-slate-500">{section.subtitle}</p>
            <div className="mt-3 space-y-2">
              {section.items.map((item) => (
                <Link key={item.href} href={item.href}
                  className="flex min-h-[76px] items-center gap-3 rounded-2xl border border-slate-200 bg-white px-3 py-3 shadow-sm active:bg-slate-50">
                  <span aria-hidden="true"
                    className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-indigo-50 text-xl">
                    {item.icon}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-black">{item.title}</span>
                      {item.tag ? <span className="rounded-md bg-violet-100 px-2 py-0.5 text-[10px] font-black text-violet-700">{item.tag}</span> : null}
                    </span>
                    <span className="mt-1 block text-xs leading-5 text-slate-500">{item.detail}</span>
                  </span>
                  <span aria-hidden="true" className="shrink-0 text-xl text-slate-400">›</span>
                </Link>
              ))}
            </div>
          </section>
        ))}
        <p className="mt-7 text-xs leading-5 text-slate-500">
          ※ この入口は本人だけに表示されます。リンク先のうち既存の管理者ページは各ページ固有のアクセス権限を引き続き適用します。
          今回の「爆益前兆 × 撤退候補」は画面・APIとも本人限定です。
        </p>
      </div>
      <BottomNav />
    </main>
  );
}
