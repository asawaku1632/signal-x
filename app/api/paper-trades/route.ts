import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/app/lib/auth";
import { closePaperTrade, createPaperTrade, getPaperTrades } from "@/app/lib/paperTrades";

export const dynamic = "force-dynamic";

async function email() {
  const session = await getServerSession(authOptions);
  return session?.user?.email?.trim().toLowerCase() || null;
}

export async function GET() {
  const userEmail = await email();
  if (!userEmail) return NextResponse.json({success:false,error:"ログインが必要です"},{status:401});
  return NextResponse.json({success:true,trades:await getPaperTrades(userEmail)});
}

export async function POST(request:Request) {
  try {
    const userEmail = await email();
    if (!userEmail) return NextResponse.json({success:false,error:"ログインが必要です"},{status:401});
    const body = await request.json();
    const entryPrice = Number(body.entryPrice), investmentAmount = Number(body.investmentAmount);
    const trackingDays = body.trackingDays == null ? null : Number(body.trackingDays);
    if (!body.code || !body.name || !Number.isFinite(entryPrice) || entryPrice <= 0 || !Number.isFinite(investmentAmount) || investmentAmount <= 0) return NextResponse.json({success:false,error:"入力内容を確認してください"},{status:400});
    const trade = await createPaperTrade(userEmail,{code:String(body.code),name:String(body.name),entryPrice,investmentAmount,trackingDays,aiScore:Number.isFinite(Number(body.aiScore))?Number(body.aiScore):null,aiLabel:body.aiLabel?String(body.aiLabel):null});
    return NextResponse.json({success:true,trade});
  } catch (error) {
    return NextResponse.json({success:false,error:error instanceof Error?error.message:"疑似購入に失敗しました"},{status:500});
  }
}

export async function PATCH(request:Request) {
  const userEmail = await email();
  if (!userEmail) return NextResponse.json({success:false,error:"ログインが必要です"},{status:401});
  const body = await request.json();
  const id=Number(body.id), exitPrice=Number(body.exitPrice);
  if (!Number.isInteger(id) || !Number.isFinite(exitPrice) || exitPrice<=0) return NextResponse.json({success:false,error:"入力内容を確認してください"},{status:400});
  const trade=await closePaperTrade(userEmail,id,exitPrice);
  return trade ? NextResponse.json({success:true,trade}) : NextResponse.json({success:false,error:"対象の取引がありません"},{status:404});
}