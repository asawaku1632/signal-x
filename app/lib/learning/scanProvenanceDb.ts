import { Pool } from "pg";

// Research-only connection: never inherit DATABASE_URL or a public environment variable.
// This module is imported by the scan code but does not connect until explicitly enabled.
let shadowPool: Pool | null = null;

export function getScanProvenancePool(): Pool | null {
  if (process.env.SCAN_PROVENANCE_SHADOW_ENABLED !== "true") return null;
  const connectionString = process.env.SCAN_PROVENANCE_DATABASE_URL;
  if (!connectionString) return null; // Fail closed; never fall back to the shared pool.
  if (!shadowPool) {
    shadowPool = new Pool({
      connectionString,
      ssl: { rejectUnauthorized: false },
      max: 2,
      connectionTimeoutMillis: 1000,
      idleTimeoutMillis: 10000,
      statement_timeout: 1500,
      query_timeout: 2000,
    });
    shadowPool.on("error", () => {
      // Do not log credentials or crash the public scan on an idle client error.
    });
  }
  return shadowPool;
}
