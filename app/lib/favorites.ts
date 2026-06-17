import fs from "fs/promises";
import path from "path";

export type FavoriteStock = {
  code: string;
  name: string;
  addedAt: string;
};

const filePath = path.join(process.cwd(), "data", "favorites.json");

async function ensureFile() {
  await fs.mkdir(path.dirname(filePath), { recursive: true });

  try {
    await fs.access(filePath);
  } catch {
    await fs.writeFile(filePath, "[]", "utf-8");
  }
}

export async function getFavorites(): Promise<FavoriteStock[]> {
  await ensureFile();

  const text = await fs.readFile(filePath, "utf-8");
  return JSON.parse(text || "[]");
}

export async function addFavorite(code: string, name: string) {
  const favorites = await getFavorites();

  const exists = favorites.some((item) => item.code === code);

  if (exists) {
    return {
      added: false,
      favorites,
    };
  }

  const newFavorite: FavoriteStock = {
    code,
    name,
    addedAt: new Date().toISOString(),
  };

  const updated = [newFavorite, ...favorites];

  await fs.writeFile(filePath, JSON.stringify(updated, null, 2), "utf-8");

  return {
    added: true,
    favorites: updated,
  };
}

export async function removeFavorite(code: string) {
  const favorites = await getFavorites();

  const updated = favorites.filter((item) => item.code !== code);

  await fs.writeFile(filePath, JSON.stringify(updated, null, 2), "utf-8");

  return updated;
}