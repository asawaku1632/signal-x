import pool from '@/app/lib/postgres';

export async function recordFavoriteAlertAudit(input: {
  monitorId: string;
  code: string;
  quoteTimestamp: string;
  snapshotUpdatedAt: string | null;
  decisionAt: string;
  referencePrice: number;
  aiPower: number;
}) {
  await pool.query(
    'INSERT INTO public.favorite_alert_audit (monitor_id, code, quote_timestamp, snapshot_updated_at, decision_at, reference_price, ai_power) VALUES ($1, $2, $3, $4, $5, $6, $7) ON CONFLICT (monitor_id) DO NOTHING',
    [input.monitorId, input.code, input.quoteTimestamp, input.snapshotUpdatedAt, input.decisionAt, input.referencePrice, input.aiPower],
  );
}
