import pool from "@/app/lib/postgres";
import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  mergeNotificationPreferences,
  type NotificationPreferences,
  type NotificationType,
} from "./notificationTypes";

export async function getNotificationPreferences(userEmail: string): Promise<NotificationPreferences> {
  const result = await pool.query<{ preferences: unknown }>(
    "SELECT preferences FROM public.push_notification_preferences WHERE user_email = $1",
    [userEmail.trim().toLowerCase()],
  );
  return mergeNotificationPreferences(result.rows[0]?.preferences);
}

export async function saveNotificationPreferences(userEmail: string, preferences: NotificationPreferences) {
  await pool.query(
    `INSERT INTO public.push_notification_preferences (user_email, preferences, updated_at)
     VALUES ($1, $2::jsonb, now())
     ON CONFLICT (user_email) DO UPDATE
     SET preferences = EXCLUDED.preferences, updated_at = now()`,
    [userEmail.trim().toLowerCase(), JSON.stringify(preferences)],
  );
}

export async function isNotificationEnabled(userEmail: string, type: NotificationType): Promise<boolean> {
  const settings = await getNotificationPreferences(userEmail);
  return settings[type] ?? DEFAULT_NOTIFICATION_PREFERENCES[type];
}
