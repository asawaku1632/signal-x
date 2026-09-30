"use client";

type Props={id:number;current:number;onDone:()=>void};
export default function TradeActions({id,current,onDone}:Props){
 async function sell(){if(!confirm(`現在価格 ${current.toLocaleString()}円で疑似売却しますか？`))return;const r=await fetch("/api/paper-trades",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({id,exitPrice:current})});const j=await r.json();if(!r.ok){alert(j.error||"売却に失敗しました");return}onDone()}
 async function cancel(){if(!confirm("この疑似投資を取り消しますか？\n取消した取引は履歴・成績に残りません。"))return;const r=await fetch("/api/paper-trades",{method:"DELETE",headers:{"Content-Type":"application/json"},body:JSON.stringify({id})});const j=await r.json();if(!r.ok){alert(j.error||"取消に失敗しました");return}onDone()}
 return <div className="mt-4 grid grid-cols-2 gap-2"><button onClick={sell} className="rounded-xl bg-blue-600 py-3 text-sm font-bold text-white">疑似売却する</button><button onClick={cancel} className="rounded-xl border border-rose-200 bg-rose-50 py-3 text-sm font-bold text-rose-600">取引を取り消す</button></div>;
}
