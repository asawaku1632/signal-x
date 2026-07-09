import fs from "fs/promises";
import path from "path";

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

const filePath = path.join(process.cwd(), "data", "notification-logs.json");

async function ensureFile() {
  try {
    await fs.mkdir(path.dirname(filePath), { recursive: true });

    try {
      await fs.access(filePath);
    } catch {
      await fs.writeFile(filePath, "[]", "utf-8");
    }
  } catch (error) {
    console.warn("Notification log file is not writable:", error);
  }
}

function getJapanDateKey(dateString: string) {
  return new Date(dateString).toLocaleDateString("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

export async function getNotificationLogs(): Promise<NotificationLog[]> {
  try {
    await ensureFile();

    const text = await fs.readFile(filePath, "utf-8");
    return JSON.parse(text || "[]");
  } catch (error) {
    console.warn("Failed to read notification logs:", error);
    return [];
  }
}

export async function saveNotificationLog(
  log: Omit<
    NotificationLog,
    "id" | "notifiedAt" | "profitNotified" | "stopLossNotified"
  >
) {
  const logs = await getNotificationLogs();

  const now = new Date().toISOString();
  const todayKey = getJapanDateKey(now);

  const existingLog = logs.find((item) => {
    const itemDateKey = getJapanDateKey(item.notifiedAt);

    return item.code === log.code && itemDateKey === todayKey;
  });

  if (existingLog) {
    return {
      ...existingLog,
      skipped: true,
      reason: "same code already notified today",
    };
  }

  const newLog: NotificationLog = {
    id: `${Date.now()}-${log.code}`,
    notifiedAt: now,
    profitNotified: false,
    stopLossNotified: false,
    ...log,
  };

  logs.unshift(newLog);

  try {
    await fs.writeFile(filePath, JSON.stringify(logs, null, 2), "utf-8");
  } catch (error) {
    console.warn("Failed to save notification log:", error);

    return {
      ...newLog,
      logSaveFailed: true,
      reason: "notification sent but log save failed",
    };
  }

  return newLog;
}

export async function updateNotificationLog(
  id: string,
  updates: Partial<NotificationLog>
) {
  const logs = await getNotificationLogs();

  const updatedLogs = logs.map((log) =>
    log.id === id ? { ...log, ...updates } : log
  );

  try {
    await fs.writeFile(filePath, JSON.stringify(updatedLogs, null, 2), "utf-8");
  } catch (error) {
    console.warn("Failed to update notification log:", error);
    return undefined;
  }

  return updatedLogs.find((log) => log.id === id);
}

export async function overwriteNotificationLogs(logs: NotificationLog[]) {
  try {
    await ensureFile();

    await fs.writeFile(filePath, JSON.stringify(logs, null, 2), "utf-8");
  } catch (error) {
    console.warn("Failed to overwrite notification logs:", error);
  }

  return logs;
}