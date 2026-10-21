import pool from "@/app/lib/postgres";

/**
 * Read-only historical preview. Favorite monitor activations are not proof of
 * execution, quote freshness, or delivery of a push notification.
 */
export type BuyActivationPreview = {
  code: string;
  name: string;
  triggeredAt: string;
  referencePrice: number;
  aiPower: number;
  status: string;
  evidence: "HISTORICAL_MONITOR_UNVERIFIED_QUOTE";
};

export async function getBuyActivationPreview(limit = 100): Promise<{
  total: number;
  rows: BuyActivationPreview[];
  excluded: number;
}> {
  const safeLimit = Math.min(500, Math.max(1, Math.trunc(limit)));
  const [count, result] = await Promise.all([
    pool.query<{ total: string }>("SELECT COUNT(*)::text AS total FROM public.favorite_ai_monitors"),
    pool.query<{
      code: string; name: string; triggered_at: Date | string;
      entry_price: string | number; ai_power: string | number; status: string;
    }>(
      `SELECT code, name, triggered_at, entry_price, ai_power, status
         FROM public.favorite_ai_monitors
        ORDER BY triggered_at DESC, id DESC LIMIT $1`,
      [safeLimit],
    ),
  ]);
  const rows: BuyActivationPreview[] = [];
  let excluded = 0;
  for (const item of result.rows) {
    const timestamp = new Date(item.triggered_at);
    const price = Number(item.entry_price);
    const score = Number(item.ai_power);
    if (!item.code || !Number.isFinite(timestamp.getTime()) ||
        !Number.isFinite(price) || price <= 0 ||
        !Number.isFinite(score) || score < 0 || score > 100) {
      excluded++;
      continue;
    }
    rows.push({
      code: String(item.code), name: String(item.name),
      triggeredAt: timestamp.toISOString(), referencePrice: price,
      aiPower: score, status: String(item.status),
      evidence: "HISTORICAL_MONITOR_UNVERIFIED_QUOTE",
    });
  }
  return { total: Number(count.rows[0]?.total ?? 0), rows, excluded };
}
