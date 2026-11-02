"use client";

import {useState} from "react";

/** The owner must explicitly press the button. No background polling, no
 * storage, and no page-load fetch. The browser saves an already server-sealed
 * JSON evidence file that can be audited later.
 */
type ManualProbeResponse={
  date?:string;slot?:string;status?:string;networkCalls?:number;
  probes?:{code:string;status:string}[];
  archive?:{evidence:unknown;checksum:{algorithm:string;digest:string}};
  error?:string;
};
export default function MorningProbeDownload(){
  const [loading,setLoading]=useState(false);
  const [notice,setNotice]=useState("");
  const [failed,setFailed]=useState(false);
  async function download(){
    if(loading)return;
    setLoading(true);setFailed(false);setNotice("");
    try {
      const result=await fetch("/api/admin/morning-probe-shadow",{
        method:"GET",credentials:"same-origin",cache:"no-store",
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
    <p className="text-[11px] leading-5 text-slate-500">
      ファイルに取得時刻、失敗理由、対象銘柄、SHA-256照合値を含みます。
      SHA-256は改変検知用であり、取引所の公式証明や約定の証拠ではありません。
      再度押すと新たな通信が発生するため、同じ時刻枠の重複観測に注意してください。
    </p>
  </div>;
}
