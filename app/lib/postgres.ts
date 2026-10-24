import { Pool } from "pg";

let pool: Pool | null = null;

function getPool() {
  if (pool) return pool;

  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error("DATABASE_URL is not set");
  }

  pool = new Pool({
    connectionString,
    ssl: {
      rejectUnauthorized: false,
    },
  });

  return pool;
}

const lazyPool = new Proxy({} as Pool, {
  get(_target, property, receiver) {
    const activePool = getPool();
    const value = Reflect.get(activePool, property, receiver);
    return typeof value === "function" ? value.bind(activePool) : value;
  },
});

export default lazyPool;
