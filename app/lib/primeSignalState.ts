import pool from "@/app/lib/postgres";

export const PRIME_SIGNAL_SCORE = 95;

export async function claimPrimeSignal(code: string, score: number) {
  const normalizedCode = String(code);

  await pool.query(
    `
      INSERT INTO public.prime_signal_states (code, state, last_score, updated_at)
      VALUES ($1, 'ARMED', $2, NOW())
      ON CONFLICT (code)
      DO UPDATE SET last_score = EXCLUDED.last_score, updated_at = NOW()
    `,
    [normalizedCode, score],
  );

  const result = await pool.query<{ code: string }>(
    `
      UPDATE public.prime_signal_states
      SET notification_claimed_at = NOW(), updated_at = NOW()
      WHERE code = $1
        AND state = 'ARMED'
        AND (
          notification_claimed_at IS NULL
          OR notification_claimed_at < NOW() - INTERVAL '5 minutes'
        )
      RETURNING code
    `,
    [normalizedCode],
  );

  return Boolean(result.rows[0]);
}

export async function markPrimeSignalNotified(code: string, score: number) {
  await pool.query(
    `
      UPDATE public.prime_signal_states
      SET state = 'HOT',
          last_score = $2,
          last_notified_at = NOW(),
          notification_claimed_at = NULL,
          updated_at = NOW()
      WHERE code = $1
    `,
    [String(code), score],
  );
}

export async function releasePrimeSignalClaim(code: string) {
  await pool.query(
    `
      UPDATE public.prime_signal_states
      SET notification_claimed_at = NULL, updated_at = NOW()
      WHERE code = $1 AND state = 'ARMED'
    `,
    [String(code)],
  );
}

export async function rearmPrimeSignals(currentHotCodes: string[]) {
  const codes = currentHotCodes.map(String);

  await pool.query(
    `
      UPDATE public.prime_signal_states
      SET state = 'ARMED',
          notification_claimed_at = NULL,
          updated_at = NOW()
      WHERE state = 'HOT'
        AND NOT (code = ANY($1::text[]))
    `,
    [codes],
  );
}
