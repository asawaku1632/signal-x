"use client";

import {useState} from "react";

/** The owner must explicitly press the button. No background polling, no
 * storage, and no page-load fetch. The browser saves an already server-sealed
 * JSON evidence file that can be audited later.
 */
type ShadowReview={
  code:string;status:string;reason:string;sourceSlot:string|null;
  opening?:{changeFromFirstOpenPct?:number|null;threeBarVolume?:number|null};
  market?:{state:string;changePct?:number|null};
};
const REVIEW_LABELS:Record<string,string>={
  PAUSE_MARKET_RISK:"市場急落警戒：購入研究を停止",
  WAIT_FOR_BAR_DATA:"5分足不足：判定保留",
  WAIT_FOR_MARKET_DATA:"米国市場情報不足：判定保留",
  OVER_BUDGET_REFERENCE:"参考価格が予算を超過",
  CAUTION_REFERENCE_GAP:"前日比が大きい：慎重に監視",
  TREND_WATCH_ONLY:"上昇形状：監視のみ（買い推奨ではありません）",
  CAUTION_WEAK_MOMENTUM:"上昇の勢いを確認できず",
};
type ManualProbeResponse={
  date?:string;slot?:string;status?:string;networkCalls?:number;
  probes?:{code:string;status:string}[];
  reviews?:ShadowReview[];
  archive?:{evidence:unknown;checksum:{algorithm:string;digest:string}};
  error?:string;
};
export default function MorningProbeDownload(){
  const [loading,setLoading]=useState(false);
  const [notice,setNotice]=useState("");
  const [failed,setFailed]=useState(false);
  const [reviews,setReviews]=useState<ShadowReview[]>([]);
  async function download(){
    if(loading)return;
    setLoading(true);setFailed(false);setNotice("");setReviews([]);
    try {
      const result=await fetch("/api/admin/morning-probe-shadow",{
        method:"POST",credentials:"same-origin",cache:"no-store",
        headers:{"Accept":"application/json"},
      });
      const data=await result.json() as ManualProbeResponse;
      if(!result.ok||data.status!=="REFERENCE_RESEARCH_ONLY"||
        !data.archive?.checksum?.digest||!data.date||!data.slot)
        throw Error(data.status||data.error||"取得条件を満たしませんでした");
      const filename="signalx-morning-probe-"+data.date+"-"+data.slot.replace(":","")+".json";
      const blob=new Blob([JSON.stringify(data.archive,null,2)+"\n"],{
        type:"application/json;charset=utf-8",
      });
      const url=URL.createObjectURL(blob);
      try {
        const anchor=document.createElement("a");
        anchor.href=url;anchor.download=filename;
        document.body.appendChild(anchor);
        anchor.click();anchor.remove();
      } finally {
        // Revoking synchronously can cancel Android downloads.
        window.setTimeout(()=>URL.revokeObjectURL(url),5000);
      }
      setReviews(data.reviews??[]);
      const good=data.probes?.filter(p=>p.status==="AVAILABLE_AS_OF_RECEIPT").length??0;
      setNotice(data.date+" "+data.slot+"："+good+"/"+(data.probes?.length??0)+
        "銘柄で完成足を確認。証拠JSONの保存を要求しました。端末のダウンロード欄を確認してください。");
    }catch(error){
      setFailed(true);
      setNotice("取得・保存を完了できませんでした："+(
        error instanceof Error?error.message:"不明なエラー"));
    }finally{setLoading(false);}
  }
  return <div className="mt-3 space-y-2">
    <button type="button" onClick={download} disabled={loading}
      className="rounded-lg border border-blue-400 bg-blue-50 px-3 py-2.5 text-sm font-bold text-blue-900 disabled:opacity-50">
      {loading?"取得結果を確認中…":"5分足を確認して証拠JSONを保存"}
    </button>
    {notice?<p role={failed?"alert":"status"}
      className={"text-xs leading-5 "+(failed?"text-rose-800":"text-indigo-900")}>
      {notice}
    </p>:null}
    {reviews.length>0?<section aria-label="朝の研究用判定" className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-slate-900">
      <p className="font-bold">朝9:15以降の研究用チェック（注文・通知はしません）</p>
      <p className="mt-1">確認できた時点の完成足と前夜の米国参考指数だけを比較します。日本市場の安全や実際に買える価格は未確認です。</p>
      <ul className="mt-2 space-y-1.5">
        {reviews.map(review=><li key={review.code} className="rounded border border-amber-100 bg-white p-2">
          <span className="font-semibold">{review.code}：</span>
          {REVIEW_LABELS[review.status]??"データ未確認"}
          {review.sourceSlot?"（受信枠 "+review.sourceSlot+"）":""}
          {typeof review.opening?.changeFromFirstOpenPct==="number"?
            <span> ／ 9:00始値からの参考変化 {review.opening.changeFromFirstOpenPct}%</span>:null}
        </li>)}
      </ul>
      <p className="mt-2 text-rose-800">上昇形状でも即購入不可。先物・TOPIX・板・約定可能性・損切り条件は別途確認が必要です。</p>
    </section>:null}
    <p className="text-[11px] leading-5 text-slate-500">
      ファイルに取得時刻、失敗理由、対象銘柄、SHA-256照合値を含みます。
      SHA-256は改変検知用であり、取引所の公式証明や約定の証拠ではありません。
      再度押すと新たな通信が発生するため、同じ時刻枠の重複観測に注意してください。
    </p>
  </div>;
}
