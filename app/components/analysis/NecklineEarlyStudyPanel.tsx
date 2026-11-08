"use client";

import { useMemo } from "react";
import { analyzeNecklineTimeline } from "@/app/lib/research/necklineEarlyStudy.mjs";

type DailyBar = {
  time: number; open: number; high: number; low: number; close: number; volume?: number;
};

const yen = (n: number) => Math.round(n).toLocaleString("ja-JP") + "円";
const percent = (n: number) => (n >= 0 ? "+" : "") + n.toFixed(2) + "%";

function ResultCell({ label, result }: {
  label: string;
  result: { n: number; averagePercent: number; winRatePercent: number } | null;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-2 dark:border-slate-700 dark:bg-slate-900">
      <div className="text-[11px] font-bold text-slate-600 dark:text-slate-300">{label}</div>
      {result ? (
        <>
          <div className="mt-1 text-sm font-black text-slate-900 dark:text-white">
            {percent(result.averagePercent)} <span className="text-[11px] font-normal">平均</span>
          </div>
          <div className="text-[11px] text-slate-600 dark:text-slate-300">
            プラス率 {result.winRatePercent.toFixed(1)}% ／ {result.n}件
          </div>
        </>
      ) : <div className="mt-1 text-xs text-slate-500">結果未確定</div>}
    </div>
  );
}

/** Same completed daily series as the visual guide. Never simulates missing prices. */
export default function NecklineEarlyStudyPanel({ candles, usable }: {
  candles: DailyBar[];
  usable: boolean;
}) {
  const study = useMemo(() => analyzeNecklineTimeline(candles), [candles]);
  const latest = study.latest;
  const observedOnly = !usable || !study.dataValid;
  const state = latest?.status === "WATCH" ? "ネックライン上抜け待ち（研究観測）"
    : latest?.status === "BREAKOUT" ? "過去に終値上抜け"
    : latest?.status === "INVALIDATED" ? "安値割れで候補失効"
    : latest?.status === "EXPIRED" ? "20営業日以内に上抜けず終了" : "候補未検出";
  return (
    <details className="mt-3 rounded-xl border border-cyan-200 bg-cyan-50/70 p-3 dark:border-cyan-900 dark:bg-slate-800/50">
      <summary className="cursor-pointer text-sm font-black text-slate-900 dark:text-white">
        🔬 ネックライン早期発見・何営業日前かを検証
        <span className="ml-2 text-[10px] font-normal text-slate-600 dark:text-slate-300">日足・研究用</span>
      </summary>
      <p className="mt-2 text-xs leading-5 text-slate-700 dark:text-slate-200">
        2つの底が確定した後、当時までの確定日足だけで候補を発見した日を再計算。
        右側2本の確定足を待って底を確認します。未来の値動きから発見日をさかのぼって設定しません。
      </p>
      {observedOnly && (
        <p className="mt-2 rounded-lg bg-amber-50 p-2 text-xs font-bold text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
          日足データの鮮度・件数を確認できないため、現在の監視判定として使わないでください。
        </p>
      )}
      {!study.dataValid ? (
        <p className="mt-3 text-sm font-bold text-slate-700 dark:text-slate-200">
          有効な確定日足25本以上が必要です。研究結果は保留します。
        </p>
      ) : (
        <>
          <div className="mt-3 rounded-lg bg-white p-3 dark:bg-slate-900">
            <div className="text-xs font-black text-slate-600 dark:text-slate-300">最新の候補履歴</div>
            <div className="mt-1 text-sm font-black text-slate-900 dark:text-white">{state}</div>
            {latest ? (
              <>
                <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-2 text-xs text-slate-800 dark:text-slate-200">
                  <div>底① <strong>{yen(latest.low1)}</strong><div>{latest.low1Date}</div></div>
                  <div>底② <strong>{yen(latest.low2)}</strong><div>{latest.low2Date}</div></div>
                  <div>ネックライン候補 <strong>{yen(latest.neckline)}</strong></div>
                  <div>初検出日 <strong>{latest.firstSeenDate}</strong></div>
                  <div>上抜け確認日 <strong>{latest.breakoutDate ?? "未確認"}</strong></div>
                  <div>上抜けまで <strong>{latest.leadSessions === null ? "未確定" : latest.leadSessions + "営業日"}</strong></div>
                </div>
                {latest.breakoutDate && (
                  <p className="mt-2 text-[11px] text-slate-600 dark:text-slate-300">
                    上抜けは終値がネックラインを0.2%超えた日。
                    出来高20本平均比：
                    {latest.breakoutVolumeRatio == null ? "未取得" : latest.breakoutVolumeRatio.toFixed(2) + "倍"}。
                    上抜け判定は上昇継続の保証ではありません。
                  </p>
                )}
              </>
            ) : <p className="mt-2 text-xs text-slate-600 dark:text-slate-300">今回の取得期間では二つの底の条件を満たしていません。</p>}
          </div>
          <div className="mt-3">
            <h3 className="text-xs font-black text-slate-900 dark:text-white">取得期間内の研究集計</h3>
            <p className="mt-1 text-xs text-slate-700 dark:text-slate-200">
              候補 {study.totalCandidates}件 ／ 終値上抜け {study.totalBreakouts}件 ／
              初検出から7営業日以上で上抜け {study.leadSevenCount}件
            </p>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <ResultCell label="候補翌日始値で仮購入・3営業日" result={study.early3} />
              <ResultCell label="候補翌日始値で仮購入・5営業日" result={study.early5} />
              <ResultCell label="上抜け翌日始値で仮購入・3営業日" result={study.breakout3} />
              <ResultCell label="上抜け翌日始値で仮購入・5営業日" result={study.breakout5} />
            </div>
            <p className="mt-3 text-xs font-bold text-slate-800 dark:text-slate-100">
              7営業日以上前に候補が出た上抜け銘柄だけの5営業日比較
            </p>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <ResultCell label="早期候補の翌日始値" result={study.pairedSevenEarly5} />
              <ResultCell label="上抜け後の翌日始値" result={study.pairedSevenBreakout5} />
            </div>
          </div>
        </>
      )}
      <p className="mt-3 text-[11px] leading-5 text-slate-600 dark:text-slate-300">
        過去の日足を1日ずつ再生した参考検証で、当時リアルタイムに保存・通知した実績ではありません。
        売買の約定を再現したものでもありません。早期側の全候補には未突破・失効も含め、
        「7営業日前」比較は後から突破した事例だけなので選択バイアスがあります。
        買付は翌営業日始値、3・5営業日目の終値で仮売却、往復費用を一律0.2%差し引く仮定。
        注文の指値・逆指値の約定、スプレッド、株式分割調整、銘柄ごとの流動性は未検証です。
        少数例のプラス率は予測確率ではありません。通知・発注・本番のAI判定には接続しません。
      </p>
    </details>
  );
}
