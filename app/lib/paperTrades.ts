import pool from "@/app/lib/postgres";

export type PaperTrade = {
  id: number;
  code: string;
  name: string;
  entryPrice: number;
  investmentAmount: number;
  quantity: number;
  trackingDays: number | null;
  aiScore: number | null;
  aiLabel: string | null;
  status: "OPEN" | "CLOSED";
  startedAt: string;
  closedAt: string | null;
  exitPrice: number | null;
};

type PaperTradeRow = {
  id: number;
  code: string;
  name: string;
  entry_price: number;
  investment_amount: number;
  quantity: number;
  tracking_days: number | null;
  ai_score: number | null;
  ai_label: string | null;
  status: "OPEN" | "CLOSED";
  started_at: Date | string;
  closed_at: Date | string | null;
  exit_price: number | null;
};

const iso = (value: Date | string) => value instanceof Date ? value.toISOString() : String(value);

function mapTrade(row: PaperTradeRow): PaperTrade {
  return {
    id: Number(row.id), code: row.code, name: row.name,
    entryPrice: Number(row.entry_price), investmentAmount: Number(row.investment_amount),
    quantity: Number(row.quantity), trackingDays: row.tracking_days,
    aiScore: row.ai_score == null ? null : Number(row.ai_score), aiLabel: row.ai_label,
    status: row.status, startedAt: iso(row.started_at),
    closedAt: row.closed_at ? iso(row.closed_at) : null,
    exitPrice: row.exit_price == null ? null : Number(row.exit_price),
  };
}

export async function getPaperTrades(userEmail: string) {
  const result = await pool.query<PaperTradeRow>(`SELECT id, code, name, entry_price, investment_amount, quantity, tracking_days, ai_score, ai_label, status, started_at, closed_at, exit_price FROM public.paper_trades WHERE user_email=$1 ORDER BY started_at DESC`, [userEmail.trim().toLowerCase()]);
  return result.rows.map(mapTrade);
}

export async function createPaperTrade(userEmail: string, input: {code:string; name:string; entryPrice:number; investmentAmount:number; trackingDays:number|null; aiScore?:number|null; aiLabel?:string|null}) {
  const quantity = Math.floor(input.investmentAmount / input.entryPrice);
  if (quantity < 1) throw new Error("投資額が現在価格を下回っています");
  const result = await pool.query<PaperTradeRow>(`INSERT INTO public.paper_trades (user_email,code,name,entry_price,investment_amount,quantity,tracking_days,ai_score,ai_label) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id,code,name,entry_price,investment_amount,quantity,tracking_days,ai_score,ai_label,status,started_at,closed_at,exit_price`, [userEmail.trim().toLowerCase(),input.code,input.name,input.entryPrice,input.investmentAmount,quantity,input.trackingDays,input.aiScore??null,input.aiLabel??null]);
  return mapTrade(result.rows[0]);
}

export async function closePaperTrade(userEmail:string,id:number,exitPrice:number) {
  const result = await pool.query<PaperTradeRow>(`UPDATE public.paper_trades SET status='CLOSED', exit_price=$3, closed_at=now(), updated_at=now() WHERE id=$1 AND user_email=$2 AND status='OPEN' RETURNING id,code,name,entry_price,investment_amount,quantity,tracking_days,ai_score,ai_label,status,started_at,closed_at,exit_price`, [id,userEmail.trim().toLowerCase(),exitPrice]);
  return result.rows[0] ? mapTrade(result.rows[0]) : null;
}