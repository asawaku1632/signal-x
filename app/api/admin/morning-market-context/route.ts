import {NextResponse} from "next/server";
import {getLearningOwnerSession} from "@/app/lib/learningOwner";
import {
  EXTERNAL_MARKET_SYMBOLS,parseDailyMarketQuote
} from "@/app/lib/research/morningExternalContext.mjs";

export const dynamic="force-dynamic";
export const runtime="nodejs";
export const maxDuration=25;
const noCache={"Cache-Control":"private, no-store"};

async function readMarket(symbol:string,zone:string,now:Date){
  const url="https://query1.finance.yahoo.com/v8/finance/chart/"+
    encodeURIComponent(symbol)+"?range=10d&interval=1d";
  try{
    const response=await fetch(url,{cache:"no-store",
      headers:{"User-Agent":"Mozilla/5.0"},
      signal:AbortSignal.timeout(6_000)});
    if(!response.ok)return null;
    const payload=await response.json();
    return parseDailyMarketQuote(payload,zone,now);
  }catch{return null;}
}

export async function GET(){
  const {isOwner}=await getLearningOwnerSession();
  if(!isOwner)return NextResponse.json({success:false,reason:"NOT_FOUND"},
    {status:404,headers:noCache});
  const now=new Date();
  const quotes=await Promise.all(EXTERNAL_MARKET_SYMBOLS.map(async ({key,label,symbol,zone})=>{
    const data=await readMarket(symbol,zone,now);
    return {key,label,price:data?.price??null,changePct:data?.changePct??null,
      quoteDate:data?.quoteDate??null,state:data?.state??"UNAVAILABLE"};
  }));
  return NextResponse.json({
    success:true,quotes,retrievedAt:new Date().toISOString(),
    source:"Yahoo Finance 日足参考値",
    pts:{state:"UNAVAILABLE",reason:"正確なPTS約定値の取得元が未接続"},
    notice:"市場の直近参考値。日足は遅延・修正される場合があります。翌朝の株価を予測するものではありません。",
  },{headers:noCache});
}
