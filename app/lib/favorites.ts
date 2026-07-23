import pool from "@/app/lib/postgres";

export type FavoriteStock = {
  code: string;
  name: string;
  addedAt: string;
};

type FavoriteRow = {
  code: string;
  name: string;
  added_at: Date | string;
};

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function mapFavorite(row: FavoriteRow): FavoriteStock {
  return {
    code: String(row.code),
    name: String(row.name),
    addedAt:
      row.added_at instanceof Date
        ? row.added_at.toISOString()
        : String(row.added_at),
  };
}

export async function getFavorites(
  userEmail: string
): Promise<FavoriteStock[]> {
  const email = normalizeEmail(userEmail);

  if (!email) {
    return [];
  }

  const result = await pool.query<FavoriteRow>(
    `
      SELECT
        code,
        name,
        added_at
      FROM public.user_favorites
      WHERE user_email = $1
      ORDER BY added_at DESC
    `,
    [email]
  );

  return result.rows.map(mapFavorite);
}

export async function addFavorite(
  userEmail: string,
  code: string,
  name: string
) {
  const email = normalizeEmail(userEmail);
  const normalizedCode = String(code ?? "").trim();
  const normalizedName = String(name ?? "").trim();

  if (!email) {
    throw new Error("user email is required");
  }

  if (!normalizedCode) {
    throw new Error("stock code is required");
  }

  if (!normalizedName) {
    throw new Error("stock name is required");
  }

  const result = await pool.query<FavoriteRow>(
    `
      INSERT INTO public.user_favorites (
        user_email,
        code,
        name
      )
      VALUES ($1, $2, $3)
      ON CONFLICT (user_email, code)
      DO UPDATE SET
        name = EXCLUDED.name
      RETURNING
        code,
        name,
        added_at
    `,
    [email, normalizedCode, normalizedName]
  );

  const favorites = await getFavorites(email);

  return {
    added: true,
    favorite: mapFavorite(result.rows[0]),
    favorites,
  };
}

export async function removeFavorite(
  userEmail: string,
  code: string
): Promise<FavoriteStock[]> {
  const email = normalizeEmail(userEmail);
  const normalizedCode = String(code ?? "").trim();

  if (!email) {
    throw new Error("user email is required");
  }

  if (!normalizedCode) {
    throw new Error("stock code is required");
  }

  await pool.query(
    `
      DELETE FROM public.user_favorites
      WHERE user_email = $1
        AND code = $2
    `,
    [email, normalizedCode]
  );

  return getFavorites(email);
}

export async function isFavorite(
  userEmail: string,
  code: string
): Promise<boolean> {
  const email = normalizeEmail(userEmail);
  const normalizedCode = String(code ?? "").trim();

  if (!email || !normalizedCode) {
    return false;
  }

  const result = await pool.query(
    `
      SELECT 1
      FROM public.user_favorites
      WHERE user_email = $1
        AND code = $2
      LIMIT 1
    `,
    [email, normalizedCode]
  );

  return result.rowCount !== null && result.rowCount > 0;
}