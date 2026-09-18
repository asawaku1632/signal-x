import pool from "@/app/lib/postgres";

export const FAVORITE_BUY_SCORE = 85;

export type FavoriteAiMonitorStatus = "ACTIVE" | "WIN" | "LOSE" | "CANCELLED";

export type FavoriteAiMonitor = {
  id: string;
  userEmail: string;
  code: string;
  name: string;
  triggeredAt: string;
  entryPrice: number;
  aiPower: number;
  takeProfit: number;
  stopLoss: number;
  status: FavoriteAiMonitorStatus;
  completedAt: string | null;
};

type MonitorRow = {
  id: string;
  user_email: string;
  code: string;
  name: string;
  triggered_at: Date | string;
  entry_price: number | string;
  ai_power: number | string;
  take_profit: number | string;
  stop_loss: number | string;
  status: FavoriteAiMonitorStatus;
  completed_at: Date | string | null;
};

function mapRow(row: MonitorRow): FavoriteAiMonitor {
  return {
    id: row.id,
    userEmail: row.user_email,
    code: row.code,
    name: row.name,
    triggeredAt: new Date(row.triggered_at).toISOString(),
    entryPrice: Number(row.entry_price),
    aiPower: Number(row.ai_power),
    takeProfit: Number(row.take_profit),
    stopLoss: Number(row.stop_loss),
    status: row.status,
    completedAt: row.completed_at ? new Date(row.completed_at).toISOString() : null,
  };
}

export async function getAllFavorites() {
  const result = await pool.query<{ user_email: string; code: string; name: string }>(`
    SELECT user_email, code, name
    FROM public.user_favorites
    ORDER BY user_email, added_at
  `);
  return result.rows.map((row) => ({
    userEmail: row.user_email.trim().toLowerCase(),
    code: String(row.code),
    name: row.name,
  }));
}

export async function getActiveFavoriteAiMonitors() {
  const result = await pool.query<MonitorRow>(`
    SELECT id, user_email, code, name, triggered_at, entry_price, ai_power,
           take_profit, stop_loss, status, completed_at
    FROM public.favorite_ai_monitors
    WHERE status = 'ACTIVE'
    ORDER BY triggered_at ASC
  `);
  return result.rows.map(mapRow);
}

export async function startFavoriteAiMonitor(input: {
  userEmail: string;
  code: string;
  name: string;
  entryPrice: number;
  aiPower: number;
  takeProfit: number;
  stopLoss: number;
}) {
  const id = `${Date.now()}-${input.code}-${Math.random().toString(36).slice(2, 8)}`;
  const result = await pool.query<MonitorRow>(`
    INSERT INTO public.favorite_ai_monitors
      (id, user_email, code, name, entry_price, ai_power, take_profit, stop_loss)
    SELECT $1, $2, $3, $4, $5, $6, $7, $8
    WHERE NOT EXISTS (
      SELECT 1 FROM public.favorite_ai_monitors
      WHERE user_email = $2 AND code = $3 AND status = 'ACTIVE'
    )
    RETURNING id, user_email, code, name, triggered_at, entry_price, ai_power,
              take_profit, stop_loss, status, completed_at
  `, [id, input.userEmail.trim().toLowerCase(), String(input.code), input.name,
       input.entryPrice, input.aiPower, input.takeProfit, input.stopLoss]);
  return result.rows[0] ? mapRow(result.rows[0]) : null;
}

export async function cancelFavoriteAiMonitor(userEmail: string, code: string) {
  const result = await pool.query<MonitorRow>(`
    UPDATE public.favorite_ai_monitors
    SET status = 'CANCELLED', completed_at = NOW(), updated_at = NOW()
    WHERE user_email = $1 AND code = $2 AND status = 'ACTIVE'
    RETURNING id, user_email, code, name, triggered_at, entry_price, ai_power,
              take_profit, stop_loss, status, completed_at
  `, [userEmail.trim().toLowerCase(), String(code)]);
  return result.rows.map(mapRow);
}

export async function completeFavoriteAiMonitor(
  id: string,
  status: Extract<FavoriteAiMonitorStatus, "WIN" | "LOSE" | "CANCELLED">,
) {
  const result = await pool.query<MonitorRow>(`
    UPDATE public.favorite_ai_monitors
    SET status = $2, completed_at = NOW(), updated_at = NOW()
    WHERE id = $1 AND status = 'ACTIVE'
    RETURNING id, user_email, code, name, triggered_at, entry_price, ai_power,
              take_profit, stop_loss, status, completed_at
  `, [id, status]);
  return result.rows[0] ? mapRow(result.rows[0]) : null;
}
