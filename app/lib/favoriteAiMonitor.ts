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

let tableReadyPromise: Promise<void> | null = null;

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

async function ensureTable() {
  if (!tableReadyPromise) {
    tableReadyPromise = pool.query(`
      CREATE TABLE IF NOT EXISTS public.favorite_ai_monitors (
        id TEXT PRIMARY KEY,
        user_email TEXT NOT NULL,
        code TEXT NOT NULL,
        name TEXT NOT NULL,
        triggered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        entry_price DOUBLE PRECISION NOT NULL,
        ai_power INTEGER NOT NULL,
        take_profit DOUBLE PRECISION NOT NULL,
        stop_loss DOUBLE PRECISION NOT NULL,
        status TEXT NOT NULL DEFAULT 'ACTIVE'
          CHECK (status IN ('ACTIVE', 'WIN', 'LOSE', 'CANCELLED')),
        completed_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `).then(() => undefined).catch((error) => {
      tableReadyPromise = null;
      throw error;
    });
  }
  return tableReadyPromise;
}

export async function getActiveFavoriteAiMonitors() {
  await ensureTable();
  const result = await pool.query<MonitorRow>(`
    SELECT id, user_email, code, name, triggered_at, entry_price, ai_power,
           take_profit, stop_loss, status, completed_at
    FROM public.favorite_ai_monitors
    WHERE status = 'ACTIVE'
    ORDER BY triggered_at ASC
  `);
  return result.rows.map(mapRow);
}

export async function hasActiveFavoriteAiMonitor(userEmail: string, code: string) {
  await ensureTable();
  const result = await pool.query(`
    SELECT 1 FROM public.favorite_ai_monitors
    WHERE user_email = $1 AND code = $2 AND status = 'ACTIVE'
    LIMIT 1
  `, [userEmail.trim().toLowerCase(), String(code)]);
  return (result.rowCount ?? 0) > 0;
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
  await ensureTable();
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
  `, [
    id,
    input.userEmail.trim().toLowerCase(),
    String(input.code),
    input.name,
    input.entryPrice,
    input.aiPower,
    input.takeProfit,
    input.stopLoss,
  ]);
  return result.rows[0] ? mapRow(result.rows[0]) : null;
}

export async function completeFavoriteAiMonitor(
  id: string,
  status: Extract<FavoriteAiMonitorStatus, "WIN" | "LOSE" | "CANCELLED">,
) {
  await ensureTable();
  const result = await pool.query<MonitorRow>(`
    UPDATE public.favorite_ai_monitors
    SET status = $2, completed_at = NOW(), updated_at = NOW()
    WHERE id = $1 AND status = 'ACTIVE'
    RETURNING id, user_email, code, name, triggered_at, entry_price, ai_power,
              take_profit, stop_loss, status, completed_at
  `, [id, status]);
  return result.rows[0] ? mapRow(result.rows[0]) : null;
}
