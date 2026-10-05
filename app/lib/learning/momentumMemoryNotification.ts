import pool from "@/app/lib/postgres";
import { pushWebToUser } from "@/app/lib/push/userPush";
import YahooFinance from "yahoo-finance2";

const yahooFinance = new YahooFinance({ suppressNotices: ["yahooSurvey"] });

async function captureNotificationPrice(code: string) {
  try {
    const quote = await yahooFinance.quote(`${code}.T`);
    const price = Number(quote.regularMarketPrice);
    if (!Number.isFinite(price) || price <= 0) return null;
    return { price, capturedAt: new Date(), source: "YAHOO_FINANCE_QUOTE" };
  } catch (error) {
    console.error(`Momentum Memory quote capture failed for ${code}:`, error);
    return null;
  }
}

function adminEmails() {
  return [process.env.ADMIN_EMAIL, process.env.ADMIN_EMAILS]
    .filter(Boolean)
    .flatMap((value) => String(value).split(","))
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
}

export async function notifyMomentumMemoryCandidates(targetDate: string) {
  const admins = [...new Set(adminEmails())];
  if (admins.length === 0) return { notified: 0, reason: "NO_ADMIN_EMAIL" as const };

  const result = await pool.query<{
    id: string; code: string; name: string | null; profile_key: string;
    current_ai_power: number; prev3_avg_ai_power: number; ai_power_drop_from_peak: number;
  }>(`
    SELECT m.id::text, m.code, COALESCE(d.name, p.name) AS name,
      m.profile_key, m.current_ai_power, m.prev3_avg_ai_power, m.ai_power_drop_from_peak
    FROM momentum_memory_observations m
    LEFT JOIN LATERAL (
      SELECT name FROM daily_stock_results d
      WHERE d.code=m.code AND d.date::date=m.trade_date
      ORDER BY d.created_at DESC LIMIT 1
    ) d ON true
    LEFT JOIN LATERAL (
      SELECT name FROM pattern_learning_logs p
      WHERE p.code=m.code AND p.trade_date=m.trade_date
      ORDER BY p.created_at DESC LIMIT 1
    ) p ON true
    WHERE m.trade_date=$1::date
      AND m.validation_mode='FORWARD'
      AND m.observation_flag=TRUE
      AND m.confirmation_key='MACD_GC'
      AND m.profile_key IN ('STABLE_REBOUND','EXPLOSIVE_REBOUND')
      AND NOT EXISTS (
        SELECT 1 FROM momentum_memory_notifications n
        WHERE n.observation_id=m.id AND n.channel='ADMIN_WEB_PUSH'
      )
    ORDER BY m.research_score DESC,m.code
  `, [targetDate]);

  let notified = 0;
  for (const row of result.rows) {
    const type = row.profile_key === "EXPLOSIVE_REBOUND" ? "爆発反発型" : "安定反発型";
    const title = `🚀 爆益前兆通知：${type}`;
    const snapshot = await captureNotificationPrice(row.code);
    const body = `${row.name ?? row.code} (${row.code})で爆益につながる可能性のある前兆を検出 / AI ${Number(row.current_ai_power).toFixed(1)} / 3日平均 ${Number(row.prev3_avg_ai_power).toFixed(1)} / 落差 ${Number(row.ai_power_drop_from_peak).toFixed(1)}`;
    let sent = false;
    for (const email of admins) {
      const delivery = await pushWebToUser(email, {
        title,
        body,
        url: "/admin/momentum-memory",
        tag: `momentum-memory-${row.id}`,
      });
      if (delivery.ok) sent = true;
    }
    if (sent) {
      await pool.query(
        `INSERT INTO momentum_memory_notifications(
           observation_id,channel,notification_price,price_captured_at,price_source,
           profile_key,ai_power,prev3_avg_ai_power,ai_power_drop_from_peak
         )
         VALUES($1,'ADMIN_WEB_PUSH',$2,$3,$4,$5,$6,$7,$8)
         ON CONFLICT (observation_id,channel) DO NOTHING`,
        [
          row.id,
          snapshot?.price ?? null,
          snapshot?.capturedAt ?? null,
          snapshot?.source ?? null,
          row.profile_key,
          row.current_ai_power,
          row.prev3_avg_ai_power,
          row.ai_power_drop_from_peak,
        ],
      );
      notified += 1;
    }
  }
  return { notified, candidates: result.rows.length };
}
