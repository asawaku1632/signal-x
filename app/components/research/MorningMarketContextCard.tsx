"use client";

import {useEffect,useState} from "react";

type Quote={key:string;label:string;price:number|null;changePct:number|null;
  quoteDate:string|null;state:"REFERENCE"|"STALE"|"UNAVAILABLE"};
type MarketPayload={success:boolean;quotes:Quote[];retrievedAt:string;
  source:string;pts:{state:string;reason:string};notice:string};

const signed=(value:number|null)=>value===null||!Number.isFinite(value)?"—":
  (value>0?"+":"")+value.toFixed(2)+"%";
const numbers=(value:number|null,key:string)=>value===null||!Number.isFinite(value)?"—":
  value.toLocaleString("ja-JP",{
    minimumFractionDigits:key==="usdJpy"?2:0,maximumFractionDigits:2});

export default function MorningMarketContextCard(){
  const [payload,setPayload]=useState<MarketPayload|null>(null);
  const [loading,setLoading]=useState(true);
  const [failed,setFailed]=useState(false);
  useEffect(()=>{
    const ctrl=new AbortController();
    async function load(){
      try{
        const r=await fetch("/api/admin/morning-market-context",
          {cache:"no-store",signal:ctrl.signal});
        if(!r.ok)throw Error("MARKET_CONTEXT_UNAVAILABLE");
        const data=await r.json() as MarketPayload;
        if(!data.success||!Array.isArray(data.quotes))throw Error("MARKET_CONTEXT_INVALID");
        if(!ctrl.signal.aborted)setPayload(data);
      }catch{if(!ctrl.signal.aborted)setFailed(true);}
      finally{if(!ctrl.signal.aborted)setLoading(false);}
    }
    void load();
    return ()=>ctrl.abort();
  },[]);
  return <section className="rounded-2xl border border-sky-200 bg-white p-4" aria-label="朝の市場環境">
    <div className="flex items-center justify-between gap-2">
      <div>
        <p className="text-[10px] font-black tracking-widest text-sky-700">PRE-MARKET CONTEXT / 参考観測</p>
        <h2 className="mt-1 text-lg font-black">🌍 朝の市場環境チェック</h2>
      </div>
      <span className="rounded-lg bg-slate-100 px-2 py-1 text-[10px] font-bold text-slate-600">
        本人専用・発注なし
      </span>
    </div>
    <p className="mt-2 text-xs leading-5 text-slate-600">
      前夜の米国株・ドル円とPTSを確認するための情報欄。
      米国株や為替の変化だけで日本株の寄り付きを決めつけません。
    </p>
    {loading?<p className="mt-3 text-sm text-slate-600">市場参考値を取得中…</p>:
      failed?<p className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
        市場情報を取得できません。未取得の値は表示しません。
      </p>:null}
    {payload?<div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
      {payload.quotes.map(q=><div key={q.key} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
        <p className="text-xs font-bold">{q.label}</p>
        <p className="mt-1 text-lg font-black">{numbers(q.price,q.key)}</p>
        <p className={"mt-1 text-sm font-black "+(q.changePct===null?"text-slate-600":
          q.changePct>0?"text-red-700":q.changePct<0?"text-blue-700":"text-slate-600")}>
          {signed(q.changePct)}
        </p>
        <p className="mt-1 text-[11px] text-slate-500">
          {q.state==="UNAVAILABLE"?"取得できません":q.state==="STALE"?"過去の参考値":"直近の日足参考値"}
          {q.quoteDate?" / "+q.quoteDate:""}
        </p>
      </div>)}
    </div>:null}
    <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3">
      <p className="text-sm font-black text-amber-950">🌙 PTS（夜間取引）</p>
      <p className="mt-1 text-xs leading-5 text-amber-900">
        まだ取得元が接続されていません。PTSは証券会社で銘柄ごとの実際の値を確認してください。
        通常市場の株価をPTS価格として代用しません。
      </p>
    </div>
    <p className="mt-2 text-[11px] leading-5 text-slate-500">
      {payload?.source??"市場データ"}・{payload?.notice??
        "価格データは遅延する可能性があります。"}
      これは当日9:05の判定条件や過去成績にはまだ加えていない独立の参考欄です。
    </p>
  </section>;
}
