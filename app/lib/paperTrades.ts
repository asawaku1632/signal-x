import pool from "@/app/lib/postgres";

export type PaperTrade = {
  id: number; code: string; name: string; entryPrice: number; investmentAmount: number;
  quantity: number; trackingDays: number | null; aiScore: number | null; aiLabel: string | null;
  status: "OPEN" | "CLOSED"; startedAt: string; closedAt: string | null; exitPrice: number | null;
};
type PaperTradeRow = {
  id:number; code:string; name:string; entry_price:number; investment_amount:number; quantity:number;
  tracking_days:number|null; ai_score:number|null; ai_label:string|null; status:"OPEN"|"CLOSED";
  started_at:Date|string; closed_at:Date|string|null; exit_price:number|null;
};
const iso=(v:Date|string)=>v instanceof Date?v.toISOString():String(v);
function mapTrade(r:PaperTradeRow):PaperTrade{return {id:Number(r.id),code:r.code,name:r.name,entryPrice:Number(r.entry_price),investmentAmount:Number(r.investment_amount),quantity:Number(r.quantity),trackingDays:r.tracking_days,aiScore:r.ai_score==null?null:Number(r.ai_score),aiLabel:r.ai_label,status:r.status,startedAt:iso(r.started_at),closedAt:r.closed_at?iso(r.closed_at):null,exitPrice:r.exit_price==null?null:Number(r.exit_price)}}
export async function getPaperTrades(userEmail:string){const r=await pool.query<PaperTradeRow>(`SELECT id,code,name,entry_price,investment_amount,quantity,tracking_days,ai_score,ai_label,status,started_at,closed_at,exit_price FROM public.paper_trades WHERE user_email=$1 ORDER BY started_at DESC`,[userEmail.trim().toLowerCase()]);return r.rows.map(mapTrade)}
export async function createPaperTrade(userEmail:string,input:{code:string;name:string;entryPrice:number;investmentAmount:number;trackingDays:number|null;aiScore?:number|null;aiLabel?:string|null}){const quantity=Math.floor(input.investmentAmount/input.entryPrice);if(quantity<1)throw new Error("投資額が現在価格を下回っています");const r=await pool.query<PaperTradeRow>(`INSERT INTO public.paper_trades (user_email,code,name,entry_price,investment_amount,quantity,tracking_days,ai_score,ai_label) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id,code,name,entry_price,investment_amount,quantity,tracking_days,ai_score,ai_label,status,started_at,closed_at,exit_price`,[userEmail.trim().toLowerCase(),input.code,input.name,input.entryPrice,input.investmentAmount,quantity,input.trackingDays,input.aiScore??null,input.aiLabel??null]);return mapTrade(r.rows[0])}
export async function closePaperTrade(userEmail:string,id:number,exitPrice:number){const r=await pool.query<PaperTradeRow>(`UPDATE public.paper_trades SET status='CLOSED',exit_price=$3,closed_at=now(),updated_at=now() WHERE id=$1 AND user_email=$2 AND status='OPEN' RETURNING id,code,name,entry_price,investment_amount,quantity,tracking_days,ai_score,ai_label,status,started_at,closed_at,exit_price`,[id,userEmail.trim().toLowerCase(),exitPrice]);return r.rows[0]?mapTrade(r.rows[0]):null}
export async function cancelPaperTrade(userEmail:string,id:number){const r=await pool.query(`DELETE FROM public.paper_trades WHERE id=$1 AND user_email=$2 AND status='OPEN'`,[id,userEmail.trim().toLowerCase()]);return (r.rowCount??0)>0}
