import pool from "@/app/lib/postgres";

export async function getLineUserId(userEmail: string) {
  const result = await pool.query<{ line_user_id: string }>(`
    SELECT line_user_id
    FROM public.line_user_bindings
    WHERE user_email = $1
    LIMIT 1
  `, [userEmail.trim().toLowerCase()]);
  return result.rows[0]?.line_user_id ?? null;
}

export async function pushLineToUser(lineUserId: string, message: string) {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!token) return { ok: false, status: 500, text: "LINE token missing" };

  const response = await fetch("https://api.line.me/v2/bot/message/push", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      to: lineUserId,
      messages: [{ type: "text", text: message }],
    }),
  });
  return { ok: response.ok, status: response.status, text: await response.text() };
}
