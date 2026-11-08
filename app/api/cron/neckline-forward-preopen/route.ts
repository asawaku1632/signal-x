import {NextResponse} from "next/server";
import {requireCronAuth} from "@/app/lib/cronAuth";
import {runNecklineForwardPreopen} from "@/app/lib/research/necklineForwardRunner";

export const runtime="nodejs";
export const dynamic="force-dynamic";
export const maxDuration=60;

export async function GET(request:Request) {
  const denied=requireCronAuth(request);
  if(denied)return denied;
  const url=new URL(request.url);
  const raw=url.searchParams.get("batch");
  if(raw===null||!/^[012]$/.test(raw)){
    return NextResponse.json({success:false,error:"INVALID_BATCH"},{status:400});
  }
  try{
    const result=await runNecklineForwardPreopen(Number(raw));
    return NextResponse.json(result,{
      status:result.success?200:503,
      headers:{"Cache-Control":"private, no-store"}
    });
  }catch(error){
    console.error("[neckline-forward] unexpected runner error",error);
    return NextResponse.json({success:false,error:"NECKLINE_FORWARD_UNAVAILABLE"},{
      status:503,headers:{"Cache-Control":"private, no-store"}
    });
  }
}
