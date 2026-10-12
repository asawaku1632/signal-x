import Link from "next/link";
import { notFound } from "next/navigation";
import { getLearningOwnerSession } from "@/app/lib/learningOwner";
import { fetchCohort, dateJst } from "@/app/lib/research/shadowCandleYahoo";
import { studyMsbMaSwing, SWING_RESEARCH_VARIANTS } from "@/app/lib/research/msbMaSwing";

export const dynamic = "force-dynamic";
export const revalidate = 0;
type Props = { searchParams: Promise<{ codes?: string; preset?: string }> };
const PRESETS: Record<string, string> = {
  A: "3182,3387,6855,7203,9984",
  B: "1605,2760,3994,5805,8058",
};
const number = (n: number) => n.toLocaleString("ja-JP");
const yen = (n: number | null) => n === null ? "—" : (n > 0 ? "+" : "") + number(n) + "円";
const pct = (n: number | null) => n === null ? "—" : n.toFixed(1) + "%";

export default async function ShadowMsbObSwingPage({ searchParams }: Props) {
  const { isOwner } = await getLearningOwnerSession();
  if (!isOwner) notFound();

  const params = await searchParams;
  const raw = typeof params.preset === "string" && Object.hasOwn(PRESETS, params.preset)
    ? PRESETS[params.preset] : typeof params.codes === "string" ? params.codes.slice(0, 80) : "";
  const attempted = raw.trim().length > 0;
  const codes = raw.trim().split(/[\s,、]+/).filter(Boolean);
  const inputError = attempted && (!codes.length || codes.length > 5 ||
    new Set(codes).size !== codes.length || codes.some(code => !/^[0-9]{4}$/.test(code)))
    ? "日本株4桁コードを重複なく1〜5件指定してください。" : null;

  // Owner and input checks MUST precede external requests. Opening an empty page does nothing.
  const loaded = attempted && !inputError ? await fetchCohort(codes) : [];
  const successful = loaded.filter(row => !row.error);
  const report = studyMsbMaSwing(successful.map(row => ({ code: row.code, candles: row.candles })));
  const first = successful.map(r => r.candles[0]?.time).filter((x): x is number => x !== undefined);
  const last = successful.map(r => r.candles.at(-1)?.time).filter((x): x is number => x !== undefined);
  const range = first.length && last.length ? dateJst(Math.min(...first)) + " 〜 " + dateJst(Math.max(...last)) : "—";

  return <main className="min-h-screen bg-slate-50 px-3 py-5 pb-24 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
    <div className="mx-auto max-w-3xl space-y-4">
      <Link href="/admin/learning-hub" className="text-sm font-bold text-blue-700 dark:text-blue-300">← 学習管理へ戻る</Link>
      <header>
        <p className="text-xs font-black tracking-widest text-indigo-700 dark:text-indigo-300">OWNER RESEARCH / SHADOW ONLY</p>
        <h1 className="mt-1 text-2xl font-black">🧪 大口の痕跡？ MSB・OB × 5日/25日線</h1>
        <p className="mt-2 text-sm leading-6">「構造突破のあと売りが出やすかった足の価格帯まで戻って反発」という仮説を、出来高と移動平均線と合わせて比較します。</p>
      </header>
      <section className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-xs leading-6 text-amber-950">
        <p className="font-black text-sm">🔒 本人専用・観察のみ。本番AI/LINE通知/学習履歴/疑似購入は変更しません。</p>
        <p className="mt-1">大口注文の実測ではありません。OHLCVの形から推測するMSB・オーダーブロックの研究仮説です。AI POWERを過去にさかのぼって復元した比較ではありません。</p>
        <p className="mt-1">「検証する」を押した場合だけ最大5銘柄・過去6か月（最大135本）のYahoo参考日足を取得。DBへの書き込み・自動監視・Cron・有料データ契約の追加なし。通信とVercel処理の利用枠は消費する場合があります。</p>
      </section>
      <section className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
        <form action="/admin/shadow-msb-ob-swing" method="get">
          <label htmlFor="codes" className="text-sm font-black">調べる銘柄コード（1〜5件）</label>
          <input id="codes" name="codes" defaultValue={raw} maxLength={80}
            placeholder="例：3182,3387,6855,7203,9984"
            className="mt-2 w-full rounded-xl border border-slate-300 bg-white p-3 text-base text-slate-900" />
          <div className="mt-3 grid grid-cols-3 gap-2">
            <button type="submit" className="min-h-12 rounded-xl bg-blue-700 px-2 text-sm font-black text-white">検証する</button>
            <button name="preset" value="A" className="min-h-12 rounded-xl border border-blue-300 px-2 text-xs font-black text-blue-700 dark:text-blue-300">サンプルA</button>
            <button name="preset" value="B" className="min-h-12 rounded-xl border border-blue-300 px-2 text-xs font-black text-blue-700 dark:text-blue-300">サンプルB</button>
          </div>
        </form>
        <p className="mt-2 text-xs text-slate-500">初期表示ではデータを取得しません。サンプル銘柄は統計的に無作為抽出したものではありません。</p>
        {inputError && <p role="alert" className="mt-2 text-sm font-bold text-red-700">{inputError}</p>}
      </section>
      {attempted && !inputError && <>
        <section className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
          <h2 className="text-base font-black">📊 過去データの結果</h2>
          <p className="mt-1 text-xs text-slate-500">期間：{range} ／ 有効{report.cohortCount}銘柄・計{report.candleCount}日足</p>
          <p className="mt-1 text-xs text-slate-500">基準条件で確定した観察サンプル：{report.completedBaseTrades}件 ／ 未確定候補：{report.pendingBaseCandidates}件</p>
          {loaded.filter(row => row.error).map(row => <p key={row.code} role="alert" className="mt-1 text-xs text-red-700">{row.code}：{row.error}</p>)}
          {report.invalidCodes.map(code => <p key={code} role="alert" className="mt-1 text-xs text-red-700">{code}：研究用データ検証に失敗しました。</p>)}
          <div className="mt-3 space-y-2">
            {report.stats.map(stat => {
              const def = SWING_RESEARCH_VARIANTS.find(v => v.id === stat.id)!;
              return <article key={stat.id} className="rounded-xl border border-slate-200 p-3 dark:border-slate-700">
                <h3 className="text-sm font-black">{def.label}</h3>
                <p className="mt-1 text-xs leading-5 text-slate-500">{def.criteria}</p>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <div className="rounded-lg bg-slate-100 p-2 dark:bg-slate-800">
                    <p className="text-[11px]">対象 / 勝率</p>
                    <p className="text-lg font-black">{stat.trades}件 / {pct(stat.winRatePercent)}</p>
                    <p className="text-[11px]">勝{stat.wins}・負{stat.losses} / 除外{stat.excludedFromBase}件</p>
                  </div>
                  <div className="rounded-lg bg-slate-100 p-2 dark:bg-slate-800">
                    <p className="text-[11px]">仮想100株損益合計</p>
                    <p className="text-lg font-black">{stat.trades ? yen(stat.totalProfitYen100) : "—"}</p>
                    <p className="text-[11px]">平均 {yen(stat.averageProfitYen100)}</p>
                  </div>
                </div>
                <p className="mt-2 text-xs leading-5">平均騰落率 {pct(stat.averageReturnPercent)} ／ 最悪の1件 {yen(stat.worstProfitYen100)} ／ 簡易最大DD {yen(stat.maxDrawdownYen100)}</p>
                {!stat.trades && <p className="mt-1 text-xs font-bold text-amber-700">対象0件：勝率は未確定です。0%ではありません。</p>}
              </article>;
            })}
          </div>
          <p className="mt-3 text-xs leading-6 text-slate-600 dark:text-slate-300">
            比較方法：①を満たす全日を抽出（5営業日保有期間は重複します）。確定足の終値で判定し翌営業日寄り付きで仮想100株買い、シグナルから5営業日後の終値で仮想売却。
            全4条件は<strong>同じ候補・同じ約定想定価格</strong>の部分集合です。想定滑り片道0.1%、税・手数料・配当・株式分割調整・資金制約は別。
            未確定の未来は勝率に含めず、損切り／利確ルールの再現も行っていません。
          </p>
        </section>
        <section className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
          <h2 className="text-base font-black">🔎 銘柄別・採用／見送り理由</h2>
          {report.trades.length === 0
            ? <p className="mt-2 text-sm text-slate-600">確定した候補がありません。0%勝率という意味ではありません。</p>
            : <details className="mt-2">
              <summary className="cursor-pointer text-sm font-black text-blue-700">直近の候補を表示（最大15件）</summary>
              <div className="mt-3 space-y-2">
                {report.trades.slice(0, 15).map(trade =>
                  <div key={trade.code + "-" + trade.signalTime} className="rounded-xl bg-slate-100 p-3 text-xs leading-6 dark:bg-slate-800">
                    <p className="text-sm font-black">{trade.code}｜{dateJst(trade.signalTime)}｜{yen(trade.profitYen100)}</p>
                    <p>翌日買い {number(trade.entryPrice)}円 → 5営業日後売り {number(trade.exitPrice)}円</p>
                    <p>5日線 {number(trade.ma5)}円 / 25日線 {number(trade.ma25)}円 / 出来高 {trade.volumeRatio === null ? "不明" : trade.volumeRatio.toFixed(2) + "倍"}</p>
                    <p>MSB・OB：{trade.orderBlock
                      ? "反発候補あり（ゾーン" + number(trade.orderBlock.zoneLow) + "〜" + number(trade.orderBlock.zoneHigh) + "円）"
                      : "今回の定義では確認なし"}</p>
                    <p>② {trade.eligible.MA525_VOLUME ? "対象" : "見送り"} / ③ {trade.eligible.MA525_MSB_OB ? "対象" : "見送り"} / ④ {trade.eligible.MA525_ALL ? "対象" : "見送り"}</p>
                  </div>)}
              </div>
            </details>}
        </section>
      </>}
      <p className="text-xs leading-6 text-slate-500">
        研究条件は仮説であり、今後の上昇確率や利益を保証しません。少数・選択銘柄・短期の過去データによる過剰適合、同じ銘柄の保有期間重複（独立した取引数ではない）、約定・株価調整・出来高欠損の制約があります。
        有望でも別期間・別銘柄で再検証してから本番AIへの反映を検討します。今回のページには自動保存はありません。
      </p>
    </div>
  </main>;
}
