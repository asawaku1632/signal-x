import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/app/lib/auth";
import { cancelPaperTrade, closePaperTrade, createPaperTrade, getPaperTrades } from "@/app/lib/paperTrades";
import { getLatestScanSnapshot } from "@/app/lib/scanSnapshot";
import { assessPaperMarketGate } from "@/app/lib/simulationIntegrity";
export const dynamic="force-dynamic";
async function email(){const s=await getServerSession(authOptions);return s?.user?.email?.trim().toLowerCase()||null}
async function verifiedSimulatedQuote(code:string, submittedPrice:number){
  const snapshot=await getLatestScanSnapshot();
  const gate=assessPaperMarketGate(new Date(),snapshot?.updatedAt??null);
  if(!gate.ok) return {ok:false,reason:"取引所休場・取引時間外またはスキャン更新待ちです。保存済み終値で疑似約定することはできません。"};
  const stocks=Array.isArray(snapshot?.payload?.stocks)?snapshot.payload.stocks:[];
  const stock=stocks.find((row:{code?:string})=>String(row.code??"")===code);
  const value=stock?.price??stock?.currentPrice;
  const price=value==null?NaN:Number(value);
  if(!Number.isFinite(price)||price<=0) return {ok:false,reason:"最新の有効な銘柄価格が見つかりません。"};
  if(Math.abs(submittedPrice/price-1)>0.001) return {ok:false,reason:"現在価格と保存スキャンが一致しません。再読み込みしてください。"};
  return {ok:true,reason:null};
}
export async function GET(){const e=await email();if(!e)return NextResponse.json({success:false,error:"ログインが必要です"},{status:401});return NextResponse.json({success:true,trades:await getPaperTrades(e)})}
export async function POST(request:Request){try{const e=await email();if(!e)return NextResponse.json({success:false,error:"ログインが必要です"},{status:401});const b=await request.json();const entryPrice=Number(b.entryPrice),investmentAmount=Number(b.investmentAmount),trackingDays=b.trackingDays==null?null:Number(b.trackingDays);if(!b.code||!b.name||!Number.isFinite(entryPrice)||entryPrice<=0||!Number.isFinite(investmentAmount)||investmentAmount<=0)return NextResponse.json({success:false,error:"入力内容を確認してください"},{status:400});const code=String(b.code);const quote=await verifiedSimulatedQuote(code,entryPrice);
if(!quote.ok)return NextResponse.json({success:false,error:quote.reason},{status:409});
if(Math.abs(investmentAmount-100*entryPrice)>1)return NextResponse.json({success:false,error:"100株の参考投資額と一致しません"},{status:400});
const existing=(await getPaperTrades(e)).find(t=>t.status==="OPEN"&&t.code===code);if(existing)return NextResponse.json({success:false,error:`${code} ${existing.name} はすでに保有中です`,trade:existing},{status:409});const trade=await createPaperTrade(e,{code,name:String(b.name),entryPrice,investmentAmount,trackingDays,aiScore:b.aiScore==null||b.aiScore===""?null:Number.isFinite(Number(b.aiScore))?Number(b.aiScore):null,aiLabel:b.aiLabel?String(b.aiLabel):null});return NextResponse.json({success:true,trade})}catch(error){return NextResponse.json({success:false,error:error instanceof Error?error.message:"疑似購入に失敗しました"},{status:500})}}
export async function PATCH(request:Request){const e=await email();if(!e)return NextResponse.json({success:false,error:"ログインが必要です"},{status:401});const b=await request.json(),id=Number(b.id),exitPrice=Number(b.exitPrice);if(!Number.isInteger(id)||!Number.isFinite(exitPrice)||exitPrice<=0)return NextResponse.json({success:false,error:"入力内容を確認してください"},{status:400});const opened=(await getPaperTrades(e)).find(t=>t.id===id&&t.status==="OPEN");
if(!opened)return NextResponse.json({success:false,error:"対象の取引がありません"},{status:404});
const quote=await verifiedSimulatedQuote(opened.code,exitPrice);
if(!quote.ok)return NextResponse.json({success:false,error:quote.reason},{status:409});
const trade=await closePaperTrade(e,id,exitPrice);return trade?NextResponse.json({success:true,trade}):NextResponse.json({success:false,error:"対象の取引がありません"},{status:404})}
export async function DELETE(request:Request){const e=await email();if(!e)return NextResponse.json({success:false,error:"ログインが必要です"},{status:401});const b=await request.json(),id=Number(b.id);if(!Number.isInteger(id))return NextResponse.json({success:false,error:"入力内容を確認してください"},{status:400});return await cancelPaperTrade(e,id)?NextResponse.json({success:true}):NextResponse.json({success:false,error:"対象の取引がありません"},{status:404})}
