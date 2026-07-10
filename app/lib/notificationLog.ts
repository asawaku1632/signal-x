import pool from "./postgres";

export type NotificationLog = {
  id: string;
  code: string;
  name: string;
  notifiedAt: string;
  price: number;
  aiPower: number;
  judge: string;
  takeProfit: number;
  stopLoss: number;
  profitNotified?: boolean;
  stopLossNotified?: boolean;
};

type NotificationLogRow = {
  id: string;
  code: string;
  name: string;
  notified_at: Date | string;
  price: number | string;
  ai_power: number | string;
  judge: string;
  take_profit: number | string;
  stop_loss: number | string;
  profit_notified: boolean;
  stop_loss_notified: boolean;
};

let tableReadyPromise: Promise<void> | null = null;

function ensureNotificationLogsTable(): Promise<void> {
  if (!tableReadyPromise) {
    tableReadyPromise = (async () => {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS notification_logs (
          id TEXT PRIMARY KEY,
          code TEXT NOT NULL,
          name TEXT NOT NULL,
          notified_at TIMESTAMPTZ NOT NULL,
          notified_date_jst DATE NOT NULL,
          price DOUBLE PRECISION NOT NULL,
          ai_power INTEGER NOT NULL,
          judge TEXT NOT NULL,
          take_profit DOUBLE PRECISION NOT NULL,
          stop_loss DOUBLE PRECISION NOT NULL,
          profit_notified BOOLEAN NOT NULL DEFAULT FALSE,
          stop_loss_notified BOOLEAN NOT NULL DEFAULT FALSE,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          UNIQUE (code, notified_date_jst)
        )
      `);

      await pool.query(`
        CREATE INDEX IF NOT EXISTS notification_logs_notified_at_idx
        ON notification_logs (notified_at DESC)
      `);

      await pool.query(`
        CREATE INDEX IF NOT EXISTS notification_logs_code_idx
        ON notification_logs (code)
      `);
    })().catch((error) => {
      tableReadyPromise = null;
      throw error;
    });
  }

  return tableReadyPromise;
}

function getJapanDateKey(date: Date | string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(date));

  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;

  if (!year || !month || !day) {
    throw new Error("Failed to create Japan date key");
  }

  return `${year}-${month}-${day}`;
}

function mapRow(row: NotificationLogRow): NotificationLog {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    notifiedAt: new Date(row.notified_at).toISOString(),
    price: Number(row.price),
    aiPower: Number(row.ai_power),
    judge: row.judge,
    takeProfit: Number(row.take_profit),
    stopLoss: Number(row.stop_loss),
    profitNotified: Boolean(row.profit_notified),
    stopLossNotified: Boolean(row.stop_loss_notified),
  };
}

export async function getNotificationLogs(): Promise<NotificationLog[]> {
  try {
    await ensureNotificationLogsTable();

    const result = await pool.query<NotificationLogRow>(`
      SELECT
        id,
        code,
        name,
        notified_at,
        price,
        ai_power,
        judge,
        take_profit,
        stop_loss,
        profit_notified,
        stop_loss_notified
      FROM notification_logs
      ORDER BY notified_at DESC
    `);

    return result.rows.map(mapRow);
  } catch (error) {
    console.error("Failed to read notification logs from PostgreSQL:", error);
    return [];
  }
}

export async function saveNotificationLog(
  log: Omit<
    NotificationLog,
    "id" | "notifiedAt" | "profitNotified" | "stopLossNotified"
  >
) {
  const now = new Date();
  const notifiedAt = now.toISOString();
  const notifiedDateJst = getJapanDateKey(now);
  const id = `${Date.now()}-${log.code}`;

  try {
    await ensureNotificationLogsTable();

    const result = await pool.query<NotificationLogRow>(
      `
        INSERT INTO notification_logs (
          id,
          code,
          name,
          notified_at,
          notified_date_jst,
          price,
          ai_power,
          judge,
          take_profit,
          stop_loss,
          profit_notified,
          stop_loss_notified
        )
        VALUES (
          $1, $2, $3, $4, $5, $6,
          $7, $8, $9, $10, FALSE, FALSE
        )
        ON CONFLICT (code, notified_date_jst)
        DO NOTHING
        RETURNING
          id,
          code,
          name,
          notified_at,
          price,
          ai_power,
          judge,
          take_profit,
          stop_loss,
          profit_notified,
          stop_loss_notified
      `,
      [
        id,
        log.code,
        log.name,
        notifiedAt,
        notifiedDateJst,
        log.price,
        log.aiPower,
        log.judge,
        log.takeProfit,
        log.stopLoss,
      ]
    );

    if (result.rows[0]) {
      return mapRow(result.rows[0]);
    }

    const existingResult = await pool.query<NotificationLogRow>(
      `
        SELECT
          id,
          code,
          name,
          notified_at,
          price,
          ai_power,
          judge,
          take_profit,
          stop_loss,
          profit_notified,
          stop_loss_notified
        FROM notification_logs
        WHERE code = $1
          AND notified_date_jst = $2
        LIMIT 1
      `,
      [log.code, notifiedDateJst]
    );

    const existingLog = existingResult.rows[0];

    if (!existingLog) {
      throw new Error("Duplicate log detected, but existing row was not found");
    }

    return {
      ...mapRow(existingLog),
      skipped: true,
      reason: "same code already notified today",
    };
  } catch (error) {
    console.error("Failed to save notification log to PostgreSQL:", error);

    return {
      id,
      notifiedAt,
      profitNotified: false,
      stopLossNotified: false,
      ...log,
      logSaveFailed: true,
      reason: "notification sent but log save failed",
    };
  }
}

export async function updateNotificationLog(
  id: string,
  updates: Partial<NotificationLog>
): Promise<NotificationLog | undefined> {
  try {
    await ensureNotificationLogsTable();

    const currentResult = await pool.query<NotificationLogRow>(
      `
        SELECT
          id,
          code,
          name,
          notified_at,
          price,
          ai_power,
          judge,
          take_profit,
          stop_loss,
          profit_notified,
          stop_loss_notified
        FROM notification_logs
        WHERE id = $1
        LIMIT 1
      `,
      [id]
    );

    const currentRow = currentResult.rows[0];

    if (!currentRow) {
      return undefined;
    }

    const current = mapRow(currentRow);

    const next: NotificationLog = {
      ...current,
      ...updates,
      id: current.id,
    };

    const notifiedAt = new Date(next.notifiedAt).toISOString();
    const notifiedDateJst = getJapanDateKey(notifiedAt);

    const updatedResult = await pool.query<NotificationLogRow>(
      `
        UPDATE notification_logs
        SET
          code = $2,
          name = $3,
          notified_at = $4,
          notified_date_jst = $5,
          price = $6,
          ai_power = $7,
          judge = $8,
          take_profit = $9,
          stop_loss = $10,
          profit_notified = $11,
          stop_loss_notified = $12,
          updated_at = NOW()
        WHERE id = $1
        RETURNING
          id,
          code,
          name,
          notified_at,
          price,
          ai_power,
          judge,
          take_profit,
          stop_loss,
          profit_notified,
          stop_loss_notified
      `,
      [
        id,
        next.code,
        next.name,
        notifiedAt,
        notifiedDateJst,
        next.price,
        next.aiPower,
        next.judge,
        next.takeProfit,
        next.stopLoss,
        next.profitNotified ?? false,
        next.stopLossNotified ?? false,
      ]
    );

    const updatedRow = updatedResult.rows[0];

    return updatedRow ? mapRow(updatedRow) : undefined;
  } catch (error) {
    console.error("Failed to update notification log in PostgreSQL:", error);
    return undefined;
  }
}

export async function overwriteNotificationLogs(
  logs: NotificationLog[]
): Promise<NotificationLog[]> {
  const client = await pool.connect();

  try {
    await ensureNotificationLogsTable();
    await client.query("BEGIN");
    await client.query("DELETE FROM notification_logs");

    for (const log of logs) {
      const notifiedAt = new Date(log.notifiedAt).toISOString();
      const notifiedDateJst = getJapanDateKey(notifiedAt);

      await client.query(
        `
          INSERT INTO notification_logs (
            id,
            code,
            name,
            notified_at,
            notified_date_jst,
            price,
            ai_power,
            judge,
            take_profit,
            stop_loss,
            profit_notified,
            stop_loss_notified
          )
          VALUES (
            $1, $2, $3, $4, $5, $6,
            $7, $8, $9, $10, $11, $12
          )
          ON CONFLICT (code, notified_date_jst)
          DO UPDATE SET
            name = EXCLUDED.name,
            notified_at = EXCLUDED.notified_at,
            price = EXCLUDED.price,
            ai_power = EXCLUDED.ai_power,
            judge = EXCLUDED.judge,
            take_profit = EXCLUDED.take_profit,
            stop_loss = EXCLUDED.stop_loss,
            profit_notified = EXCLUDED.profit_notified,
            stop_loss_notified = EXCLUDED.stop_loss_notified,
            updated_at = NOW()
        `,
        [
          log.id,
          log.code,
          log.name,
          notifiedAt,
          notifiedDateJst,
          log.price,
          log.aiPower,
          log.judge,
          log.takeProfit,
          log.stopLoss,
          log.profitNotified ?? false,
          log.stopLossNotified ?? false,
        ]
      );
    }

    await client.query("COMMIT");

    return getNotificationLogs();
  } catch (error) {
    await client.query("ROLLBACK");
    console.error(
      "Failed to overwrite notification logs in PostgreSQL:",
      error
    );

    return logs;
  } finally {
    client.release();
  }
}