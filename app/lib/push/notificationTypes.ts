export const NOTIFICATION_CATEGORIES = [
  { key: "buy", title: "🔵 買い条件成立", description: "お気に入り銘柄のAI買い条件成立", available: true },
  { key: "take_profit", title: "🟢 利確ライン到達", description: "監視中の利確ライン到達", available: true },
  { key: "stop_loss", title: "🔴 損切ライン到達", description: "監視中の損切ライン到達", available: true },
  { key: "prime", title: "👑 大本命シグナル", description: "AI POWER 95以上の大本命候補", available: true },
  { key: "swing", title: "📈 スイング候補", description: "保有数日を想定した研究候補", available: false },
  { key: "surge", title: "🚀 爆益前兆", description: "急騰前兆パターンの研究通知", available: false },
  { key: "ai_rise", title: "⚡ AI評価急上昇", description: "AI POWERの急上昇パターン", available: false },
  { key: "price_target", title: "🎯 指定株価到達", description: "設定した株価を超えた・下回った", available: true },
  { key: "sharp_drop", title: "⚠️ 急落警戒", description: "急落リスクを検出する研究通知", available: false },
] as const;

export type NotificationType = (typeof NOTIFICATION_CATEGORIES)[number]["key"];
export type NotificationPreferences = Record<NotificationType, boolean>;

// Legacy categories default on to avoid changing existing LINE or Web Push behavior.
// Additional signals are opt-in. Research signals never dispatch before separate validation.
export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  buy: true,
  take_profit: true,
  stop_loss: true,
  prime: true,
  swing: false,
  surge: false,
  ai_rise: false,
  price_target: false,
  sharp_drop: false,
};

export const CATEGORY_KEYS = NOTIFICATION_CATEGORIES.map((category) => category.key);
export const AVAILABLE_NOTIFICATION_TYPES = new Set<NotificationType>(
  NOTIFICATION_CATEGORIES.filter((category) => category.available).map((category) => category.key),
);

export function parseNotificationPreferences(value: unknown): NotificationPreferences | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const obj = value as Record<string, unknown>;
  if (Object.keys(obj).length !== CATEGORY_KEYS.length ||
      !Object.keys(obj).every((key) => CATEGORY_KEYS.some((expected) => expected === key))) return null;
  const result = { ...DEFAULT_NOTIFICATION_PREFERENCES };
  for (const key of CATEGORY_KEYS) {
    if (typeof obj[key] !== "boolean") return null;
    result[key] = obj[key];
  }
  return result;
}

export function mergeNotificationPreferences(value: unknown): NotificationPreferences {
  const object = value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown> : {};
  const result = { ...DEFAULT_NOTIFICATION_PREFERENCES };
  for (const key of CATEGORY_KEYS) {
    if (typeof object[key] === "boolean") result[key] = object[key];
  }
  return result;
}
