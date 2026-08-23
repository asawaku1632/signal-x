import type { Pool, PoolClient } from "pg";

export type VerifiedGoogleIdentity = {
  provider: "google";
  providerSubject: string;
  email?: string | null;
  emailVerified?: boolean;
};

type SignalxUserRow = { user_id: string };
type IdentityDatabase = Pick<Pool, "connect" | "query">;

function normalizeOptionalEmail(email: string | null | undefined): string | null {
  const normalized = email?.trim().toLowerCase() ?? "";
  return normalized.length > 0 ? normalized : null;
}

function isUniqueViolation(error: unknown): boolean {
  return Boolean(
    error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "23505",
  );
}

async function findIdentityUserId(
  database: Pick<Pool | PoolClient, "query">,
  provider: string,
  providerSubject: string,
): Promise<string | null> {
  const result = await database.query<SignalxUserRow>(
    `
      SELECT user_id
      FROM public.signalx_identities
      WHERE provider = $1 AND provider_subject = $2
    `,
    [provider, providerSubject],
  );
  return result.rows[0]?.user_id ?? null;
}

async function touchIdentity(
  database: Pick<Pool | PoolClient, "query">,
  provider: string,
  providerSubject: string,
  providerEmail: string | null,
): Promise<string | null> {
  const result = await database.query<SignalxUserRow>(
    `
      UPDATE public.signalx_identities
      SET provider_email = $3, last_login_at = NOW()
      WHERE provider = $1 AND provider_subject = $2
      RETURNING user_id
    `,
    [provider, providerSubject, providerEmail],
  );
  return result.rows[0]?.user_id ?? null;
}

export function createSignalxUserResolver(database: IdentityDatabase) {
  return async function resolveVerifiedGoogleUser(
    identity: VerifiedGoogleIdentity,
  ): Promise<string> {
    const provider = identity.provider;
    const providerSubject = identity.providerSubject.trim();
    const providerEmail = normalizeOptionalEmail(identity.email);

    if (!providerSubject || providerSubject.length > 255) {
      throw new Error("Invalid verified provider subject");
    }

    const existingUserId = await findIdentityUserId(
      database,
      provider,
      providerSubject,
    );
    if (existingUserId) {
      await touchIdentity(database, provider, providerSubject, providerEmail);
      return existingUserId;
    }

    const client = await database.connect();
    try {
      await client.query("BEGIN");

      // Recheck inside the transaction to avoid unnecessary user creation when
      // another login completed between the initial read and BEGIN.
      const concurrentlyCreatedUserId = await findIdentityUserId(
        client,
        provider,
        providerSubject,
      );
      if (concurrentlyCreatedUserId) {
        await touchIdentity(client, provider, providerSubject, providerEmail);
        await client.query("COMMIT");
        return concurrentlyCreatedUserId;
      }

      const userResult = await client.query<{ id: string }>(
        `
          INSERT INTO public.signalx_users (primary_email, email_verified_at)
          VALUES ($1, CASE WHEN $2 THEN NOW() ELSE NULL END)
          RETURNING id
        `,
        [providerEmail, identity.emailVerified === true],
      );
      const userId = userResult.rows[0]?.id;
      if (!userId) throw new Error("Internal user creation returned no id");

      await client.query(
        `
          INSERT INTO public.signalx_identities (
            user_id, provider, provider_subject, provider_email
          )
          VALUES ($1, $2, $3, $4)
        `,
        [userId, provider, providerSubject, providerEmail],
      );
      await client.query("COMMIT");
      return userId;
    } catch (error) {
      await client.query("ROLLBACK");

      if (isUniqueViolation(error)) {
        // The rollback removes the losing transaction's user, so no orphan is
        // left behind. The winning identity can now be safely re-read.
        const winnerUserId = await touchIdentity(
          database,
          provider,
          providerSubject,
          providerEmail,
        );
        if (winnerUserId) return winnerUserId;
      }
      throw error;
    } finally {
      client.release();
    }
  };
}
