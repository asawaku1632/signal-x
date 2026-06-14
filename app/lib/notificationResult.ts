import fs from "fs/promises";
import path from "path";
import { NotificationLog } from "./notificationLog";

export type NotificationResult = {
  id: string;
  notificationId: string;
  code: string;
  name: string;
  notifiedAt: string;

  aiPower: number;

  entryPrice: number;
  price1h: number | null;
  closePrice: number | null;
  nextClosePrice: number | null;

  takeProfit: number;
  stopLoss: number;

  result: "WIN" | "LOSE" | "HOLD" | "UNKNOWN";

  checkedAt: string;
};

const filePath = path.join(
  process.cwd(),
  "data",
  "notification-results.json"
);

async function ensureFile() {
  await fs.mkdir(path.dirname(filePath), { recursive: true });

  try {
    await fs.access(filePath);
  } catch {
    await fs.writeFile(filePath, "[]", "utf-8");
  }
}

export async function getNotificationResults(): Promise<NotificationResult[]> {
  await ensureFile();

  const text = await fs.readFile(filePath, "utf-8");
  return JSON.parse(text || "[]");
}

export async function saveNotificationResult(
  log: NotificationLog,
  prices: {
    price1h?: number | null;
    closePrice?: number | null;
    nextClosePrice?: number | null;
  }
) {
  const results = await getNotificationResults();

  const price1h = prices.price1h ?? null;
  const closePrice = prices.closePrice ?? null;
  const nextClosePrice = prices.nextClosePrice ?? null;

  const exists = results.find(
    (r) => r.notificationId === log.id
  );

  if (exists) {
    exists.price1h = exists.price1h ?? price1h;
    exists.closePrice = exists.closePrice ?? closePrice;
    exists.nextClosePrice =
      exists.nextClosePrice ?? nextClosePrice;

    exists.aiPower = exists.aiPower ?? log.aiPower ?? 0;

    const checkPrice =
      exists.nextClosePrice ??
      exists.closePrice ??
      exists.price1h;

    if (checkPrice) {
      if (checkPrice >= log.takeProfit) {
        exists.result = "WIN";
      } else if (checkPrice <= log.stopLoss) {
        exists.result = "LOSE";
      } else {
        exists.result = "HOLD";
      }
    }

    exists.checkedAt = new Date().toISOString();

    await fs.writeFile(
      filePath,
      JSON.stringify(results, null, 2),
      "utf-8"
    );

    return exists;
  }

  let result: NotificationResult["result"] = "UNKNOWN";

  const checkPrice = nextClosePrice ?? closePrice ?? price1h;

  if (checkPrice) {
    if (checkPrice >= log.takeProfit) {
      result = "WIN";
    } else if (checkPrice <= log.stopLoss) {
      result = "LOSE";
    } else {
      result = "HOLD";
    }
  }

  const newResult: NotificationResult = {
    id: `${Date.now()}-${log.code}`,
    notificationId: log.id,
    code: log.code,
    name: log.name,
    notifiedAt: log.notifiedAt,

    aiPower: log.aiPower ?? 0,

    entryPrice: log.price,
    price1h,
    closePrice,
    nextClosePrice,

    takeProfit: log.takeProfit,
    stopLoss: log.stopLoss,

    result,

    checkedAt: new Date().toISOString(),
  };

  results.unshift(newResult);

  await fs.writeFile(
    filePath,
    JSON.stringify(results, null, 2),
    "utf-8"
  );

  return newResult;
}