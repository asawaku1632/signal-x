import crypto from "crypto";
import pool from "@/app/lib/postgres";

function hashToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export async function createLineLinkToken(input: {
  signalxUserId: string;
  userEmail?: string | null;
}) {
  const token = crypto.randomBytes(24).toString("base64url");
  const tokenHash = hashToken(token);
  await pool.query(`
    INSERT INTO public.line_link_tokens
      (token_hash, signalx_user_id, user_email, expires_at)
    VALUES ($1, $2, $3, NOW() + INTERVAL '10 minutes')
  `, [tokenHash, input.signalxUserId, input.userEmail?.trim().toLowerCase() || null]);
  return token;
}

export async function consumeLineLinkToken(token: string, lineUserId: string) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await client.query<{
      signalx_user_id: string;
      user_email: string | null;
    }>(`
      UPDATE public.line_link_tokens
      SET used_at = NOW()
      WHERE token_hash = $1
        AND used_at IS NULL
        AND expires_at > NOW()
      RETURNING signalx_user_id, user_email
    `, [hashToken(token)]);

    const link = result.rows[0];
    if (!link) {
      await client.query("ROLLBACK");
      return null;
    }

    await client.query(`
      INSERT INTO public.line_user_bindings
        (signalx_user_id, user_email, line_user_id)
      VALUES ($1, $2, $3)
      ON CONFLICT (signalx_user_id)
      DO UPDATE SET
        user_email = EXCLUDED.user_email,
        line_user_id = EXCLUDED.line_user_id,
        updated_at = NOW()
    `, [link.signalx_user_id, link.user_email, lineUserId]);

    await client.query("COMMIT");
    return link;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function getLineBinding(signalxUserId: string) {
  const result = await pool.query<{ line_user_id: string; linked_at: Date | string }>(`
    SELECT line_user_id, linked_at
    FROM public.line_user_bindings
    WHERE signalx_user_id = $1
    LIMIT 1
  `, [signalxUserId]);
  return result.rows[0] ?? null;
}
