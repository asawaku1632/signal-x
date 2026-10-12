import Link from "next/link";
import { notFound } from "next/navigation";
import { getLearningOwnerSession } from "@/app/lib/learningOwner";
import { fetchCohort, dateJst } from "@/app/lib/research/shadowCandleYahoo";
import { studyMsbMaSwing, SWING_RESEARCH_VARIANTS } from "@/app/lib/research/msbMaSwing";
import { studySwingVolumeSensitivity } from "@/app/lib/research/msbMaVolumeSensitivity";
import { MSB_PRESET_GROUPS, msbPresetCodes } from "@/app/lib/research/msbResearchPresets";
import { saveMsbVolumeResearch } from "./actions";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const maxDuration = 60;
type Props = { searchParams: Promise<{ codes?: string; preset?: string; save?: string }> };
const number = (n: number) => n.toLocaleString("ja-JP");
const yen = (n: number | null) => n === null ? "—" : (n > 0 ? "+" : "") + number(n) + "円";
const pct = (n: number | null) => n === null ? "—" : n.toFixed(1) + "%";

export default async function ShadowMsbObSwingPage({ searchParams }: Props) {
  const { isOwner } = await getLearningOwnerSession();
  if (!isOwner) notFound();

  const params = await searchParams;
  const preset = typeof params.preset === "string" ? msbPresetCodes(params.preset) : null;
  const raw = preset ? preset.join(",") : typeof params.codes === "string" ? params.codes.slice(0, 80) : "";
  const attempted = raw.trim().length > 0;
  const codes = raw.trim().split(/[\s,、]+/).filter(Boolean);
  const inputError = attempted && (!codes.length || codes.length > 5 ||
    new Set(codes).size !== codes.length || codes.some(code => !/^[0-9]{4}$/.test(code)))
    ? "日本株4桁コードを重複なく1〜5件指定してください。" : null;

  // Owner and input checks MUST precede external requests. Opening an empty page does nothing.
  const loaded = attempted && !inputError ? await fetchCohort(codes) : [];
  const successful = loaded.filter(row => !row.error);
  const report = studyMsbMaSwing(successful.map(row => ({ code: row.code, candles: row.candles })));
  const sensitivity = studySwingVolumeSensitivity(successful.map(row => ({ code: row.code, candles: row.candles })), report);
  const first = successful.map(r => r.candles[0]?.time).filter((x): x is number => x !== undefined);
  const last = successful.map(r => r.candles.at(-1)?.time).filter((x): x is number => x !== undefined);
  const range = first.length && last.length ? dateJst(Math.min(...first)) + " 〜 " + dateJst(Math.max(...last)) : "—";

  return <main className="min-h-screen bg-slate-50 px-3 py-5 pb-24 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
    <div className="mx-auto max-w-3xl space-y-4">
      <Link href="/admin/learning-hub" className="text-sm font-bold text-blue-700 dark:text-blue-300">← 学習管理へ戻る</Link>
      <Link href="/admin/shadow-msb-ob-swing/archive" prefetch={false} className="inline-flex min-h-11 items-center rounded-xl border border-indigo-300 px-3 text-sm font-black text-indigo-700 dark:text-indigo-300">💾 累積研究結果を見る（追加検証C〜H）</Link>
      <header>
        <p className="text-xs font-black tracking-widest text-indigo-700 dark:text-indigo-300">OWNER RESEARCH / SHADOW ONLY</p>
        <h1 className="mt-1 text-2xl font-black">🧪 大口の痕跡？ MSB・OB × 5日/25日線</h1>
        <p className="mt-2 text-sm leading-6">「構造突破のあと売りが出やすかった足の価格帯まで戻って反発」という仮説を、出来高と移動平均線と合わせて比較します。</p>
      </header>
      <section className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-xs leading-6 text-amber-950">
        <p className="font-black text-sm">🔒 本人専用・観察のみ。本番AI/LINE通知/学習履歴/疑似購入は変更しません。</p>
        <p className="mt-1">大口注文の実測ではありません。OHLCVの形から推測するMSB・オーダーブロックの研究仮説です。AI POWERを過去にさかのぼって復元した比較ではありません。</p>
        <p className="mt-1">「検証する」を押した場合だけ最大5銘柄・過去6か月（最大135本）のYahoo参考日足を取得。検証だけならDB保存なし。「研究結果を保存」は本人が別途押したときだけ研究専用DBに記録します。自動監視・Cron・有料データ契約の追加なし。通信とVercel処理の利用枠は消費する場合があります。</p>
      </section>
      <section className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
        <form id="msb-research-form" action="/admin/shadow-msb-ob-swing" method="get">
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
        <details className="mt-3 rounded-xl border border-slate-200 p-3 dark:border-slate-700">
          <summary className="cursor-pointer text-sm font-black">🔬 新しい銘柄を調べる（追加C〜H・各5銘柄）</summary>
          <p className="mt-2 text-xs text-slate-500">合計30銘柄を6グループに分け、1回ずつ検証します。分野別に選んだ銘柄で、無作為抽出ではありません。</p>
          <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {MSB_PRESET_GROUPS.slice(2).map(item=><button key={item.key} type="submit" form="msb-research-form"
              name="preset" value={item.key} className="min-h-11 rounded-xl border border-blue-300 p-2 text-xs font-black text-blue-700 dark:text-blue-300">{item.label}</button>)}
          </div>
        </details>
        <p className="mt-2 text-xs text-slate-500">初期表示ではデータを取得しません。サンプル銘柄は統計的に無作為抽出したものではありません。</p>
        {inputError && <p role="alert" className="mt-2 text-sm font-bold text-red-700">{inputError}</p>}
      </section>
      {params.save&&<p role="alert" className="rounded-xl bg-amber-50 p-3 text-sm font-bold text-amber-900">
        {params.save==="invalid"?"銘柄コードが不正です。":params.save==="unavailable"?"有効な確定日足がそろわなかったため保存していません。":"保存できませんでした。研究専用DBの状態を確認してください。"}
      </p>}
      {attempted && !inputError && <>
        {loaded.length===codes.length && loaded.every(r=>!r.error && r.candles.length>=60)&&report.invalidCodes.length===0&&(
          <section className="rounded-2xl border border-blue-200 bg-white p-4 dark:border-blue-900 dark:bg-slate-900">
            <h2 className="text-base font-black">💾 この結果を累積研究に追加</h2>
            <p className="mt-2 text-xs leading-6">保存するときだけ、同じ最大5銘柄の確定日足を再取得して研究専用DBへ記録します。同じ銘柄・同じシグナルは何度保存しても重複しません。A・Bと新しいC〜Hは分けて集計します。</p>
            <form action={saveMsbVolumeResearch} className="mt-3">
              <input type="hidden" name="codes" value={codes.join(",")}/>
              <button type="submit" className="min-h-12 w-full rounded-xl bg-blue-700 px-3 text-sm font-black text-white">研究結果を保存して累積を見る</button>
            </form>
            <p className="mt-2 text-xs text-slate-500">保存ボタンで株価通信が最大5回追加発生し、Vercel・DBの使用量に含まれます。自動保存なし。</p>
          </section>
        )}
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
        <section className="rounded-2xl border border-indigo-200 bg-white p-4 dark:border-indigo-800 dark:bg-slate-900">
          <h2 className="text-base font-black">🔬 出来高は何倍が適切？ MSB・OB追加研究</h2>
          <p className="mt-2 text-xs leading-6 text-slate-600 dark:text-slate-300">
            今回は<strong>MSB・OB反発が確認された候補</strong>から、同じ銘柄の5営業日保有期間が重なるものを時系列の先着順で除外し、<strong>全く同じ候補</strong>を出来高の閾値だけ変えて比較します。
            出来高は<strong>直前20営業日の平均との比率</strong>。構造突破日と、その後の反発日を別々に調べます。
          </p>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[
              ["①の元観察数", sensitivity.baseObservationCount],
              ["①の重複なし", sensitivity.nonOverlapBaseCount],
              ["MSB・OB元観察数", sensitivity.obObservationCount],
              ["MSB・OB重複なし", sensitivity.obNonOverlapCount],
            ].map(([label, value]) => <div key={String(label)} className="rounded-xl bg-slate-100 p-2 dark:bg-slate-800">
              <p className="text-[11px] text-slate-600 dark:text-slate-300">{label}</p>
              <p className="text-lg font-black">{value}件</p>
            </div>)}
          </div>
          <p className="mt-2 text-xs text-slate-500">
            MSB・OBの保有期間重複による除外：{sensitivity.obRemovedForOverlap}件 ／
            突破日の出来高不明：{sensitivity.missingBreakoutVolume}件 ／
            反発日の出来高不明：{sensitivity.missingRetestVolume}件
          </p>
          <h3 className="mt-4 text-sm font-black">出来高条件の違い（重複なしMSB・OB候補）</h3>
          <div className="mt-2 overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
            <table className="w-full min-w-[640px] text-left text-xs">
              <thead className="bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-100">
                <tr>
                  <th className="px-2 py-3">必要倍率</th>
                  <th className="px-2 py-3">突破日だけ</th>
                  <th className="px-2 py-3">反発日だけ</th>
                  <th className="px-2 py-3">両日とも</th>
                </tr>
              </thead>
              <tbody>{sensitivity.rows.map(row => <tr key={row.threshold} className="border-t border-slate-200 dark:border-slate-700">
                <th className="p-2">{row.threshold === 0 ? "条件なし" : row.threshold.toFixed(1) + "倍以上"}</th>
                {[row.breakout, row.retest, row.both].map((stat, index) => <td key={index} className="p-2 align-top">
                  <p className="font-black">{stat.count}件 / {pct(stat.winRatePercent)}</p>
                  <p className="mt-1 text-slate-500">平均 {yen(stat.averageProfitYen100)}</p>
                  <p className="text-slate-500">合計 {stat.count ? yen(stat.totalProfitYen100) : "—"}</p>
                </td>)}
              </tr>)}</tbody>
            </table>
          </div>
          <p className="mt-2 text-[11px] leading-5 text-slate-600 dark:text-slate-300">
            0倍は「出来高条件なし」で不明データも対象。1.0・1.2・1.5倍は出来高不明なら不採用。各欄の対象が0件なら勝率は「—」であり0%ではありません。
            勝率だけでなく、件数・平均100株損益・合計も確認してください。ここでの合計は独立した投資ポートフォリオの収益ではありません。
          </p>
          <details className="mt-3 rounded-xl border border-slate-200 p-3 dark:border-slate-700">
            <summary className="cursor-pointer text-sm font-black">①〜④も同一銘柄の重複を除いたら？</summary>
            <p className="mt-2 text-xs leading-5 text-slate-600 dark:text-slate-300">
              ①の元候補を先着順で重複除外してから②〜④で絞ります。上のMSB・OB専用比較と母集団が異なるので、件数や率が一致しない場合があります。
            </p>
            <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
              {sensitivity.baselineNonOverlap.map(stat => <div key={stat.id} className="rounded-lg bg-slate-100 p-3 text-xs dark:bg-slate-800">
                <p className="font-black">{stat.label}</p>
                <p className="mt-1">対象 {stat.count}件 ／ 勝率 {pct(stat.winRatePercent)}</p>
                <p>平均 {yen(stat.averageProfitYen100)} ／ 最悪 {yen(stat.worstProfitYen100)}</p>
              </div>)}
            </div>
          </details>
          <details className="mt-3 rounded-xl border border-slate-200 p-3 dark:border-slate-700">
            <summary className="cursor-pointer text-sm font-black">MSB・OB候補の突破日・反発日出来高を見る（最大15件）</summary>
            <div className="mt-2 space-y-2">{sensitivity.details.slice().sort((a,b) => b.trade.signalTime - a.trade.signalTime).slice(0,15).map(entry =>
              <div key={entry.trade.code + "-" + entry.trade.signalTime} className="rounded-lg bg-slate-100 p-3 text-xs leading-6 dark:bg-slate-800">
                <p className="font-black">{entry.trade.code}｜{dateJst(entry.trade.signalTime)}｜100株 {yen(entry.trade.profitYen100)}</p>
                <p>突破日：{entry.trade.orderBlock ? dateJst(successful.find(s => s.code === entry.trade.code)!.candles[entry.trade.orderBlock.breakIndex].time) : "—"}
                  ／ 出来高 {entry.breakoutRatio === null ? "不明" : entry.breakoutRatio.toFixed(2) + "倍"}</p>
                <p>反発日：{dateJst(entry.trade.signalTime)} ／ 出来高 {entry.retestRatio === null ? "不明" : entry.retestRatio.toFixed(2) + "倍"}</p>
              </div>)}
            </div>
          </details>
          <p className="mt-3 text-xs leading-5 text-slate-500">
            同一銘柄の保有期間だけを除外しており、異なる銘柄の相関は残ります。先着選択法による偏りがあり、条件の優劣はこの短期間だけでは結論できません。
            MSB・OBは価格データによる仮説で、実際の大口注文を確認したものではありません。既存の①〜④やAI判定は変更していません。
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
        有望でも別期間・別銘柄で再検証してから本番AIへの反映を検討します。本人の明示操作以外に保存はしません。
      </p>
    </div>
  </main>;
}
