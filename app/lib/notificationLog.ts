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
};

const filePath = path.join(process.cwd(), "data", "notification-logs.json");

async function ensureFile() {
  await fs.mkdir(path.dirname(filePath), { recursive: true });

  try {
    await fs.access(filePath);
  } catch {
    await fs.writeFile(filePath, "[]", "utf-8");
  }
}

export async function getNotificationLogs(): Promise<NotificationLog[]> {
  await ensureFile();

  const text = await fs.readFile(filePath, "utf-8");
  return JSON.parse(text || "[]");
}

export async function saveNotificationLog(
  log: Omit<NotificationLog, "id" | "notifiedAt">
) {
  const logs = await getNotificationLogs();

  const newLog: NotificationLog = {
    id: `${Date.now()}-${log.code}`,
    notifiedAt: new Date().toISOString(),
    ...log,
  };

  logs.unshift(newLog);

  await fs.writeFile(filePath, JSON.stringify(logs, null, 2), "utf-8");

  return newLog;
}