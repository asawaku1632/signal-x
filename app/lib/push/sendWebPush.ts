import webpush from "web-push";
import type { PushPayload, StoredPushSubscription, WebPushSendResult } from "./types";

const RETRY_DELAYS_MS = [350, 900];
const TRANSIENT_STATUS_CODES = new Set([429, 500, 502, 503, 504]);

type WebPushError = Error & {
  statusCode?: number;
  headers?: Record<string, string | string[] | undefined>;
};

function getVapidDetails() {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim();
  const privateKey = process.env.VAPID_PRIVATE_KEY?.trim();
  const subject = process.env.VAPID_SUBJECT?.trim();

  if (!publicKey || !privateKey || !subject || !/^(mailto:|https:\/\/)/.test(subject)) {
    throw new Error("Web Push VAPID configuration is missing or invalid");
  }
  return { publicKey, privateKey, subject };
}

function delay(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function retryDelay(error: WebPushError, attempt: number) {
  if (error.statusCode === 429) {
    const value = error.headers?.["retry-after"];
    const seconds = Number(Array.isArray(value) ? value[0] : value);
    if (Number.isFinite(seconds)) return Math.min(Math.max(seconds * 1000, 0), 2_000);
  }
  return RETRY_DELAYS_MS[attempt] ?? 0;
}

export async function sendWebPush(
  subscription: StoredPushSubscription,
  payload: PushPayload,
): Promise<WebPushSendResult> {
  const vapidDetails = getVapidDetails();
  const pushSubscription = {
    endpoint: subscription.endpoint,
    keys: { p256dh: subscription.p256dh, auth: subscription.auth },
  };

  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt += 1) {
    try {
      const response = await webpush.sendNotification(
        pushSubscription,
        JSON.stringify(payload),
        { TTL: 60, urgency: "normal", timeout: 10_000, vapidDetails },
      );
      return { ok: true, statusCode: response.statusCode };
    } catch (unknownError) {
      const error = unknownError as WebPushError;
      const statusCode = typeof error.statusCode === "number" ? error.statusCode : null;
      const retryable = statusCode === null || TRANSIENT_STATUS_CODES.has(statusCode);
      if (!retryable || attempt === RETRY_DELAYS_MS.length) {
        return { ok: false, statusCode, retryable };
      }
      await delay(retryDelay(error, attempt));
    }
  }

  return { ok: false, statusCode: null, retryable: false };
}
