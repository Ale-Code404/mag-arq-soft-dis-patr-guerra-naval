import { createPool, Pool } from "mysql2/promise";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Connection settings come from the environment (.env in development, the
// compose file when deployed), never from the code.
export function connect(env: NodeJS.ProcessEnv = process.env): Pool {
  return createPool({
    host: env.DB_HOST ?? "127.0.0.1",
    port: Number(env.DB_PORT ?? 3306),
    user: env.DB_USER ?? "guerra_naval",
    password: env.DB_PASSWORD,
    database: env.DB_NAME ?? "guerra_naval",
    connectionLimit: Number(env.DB_POOL_SIZE ?? 10),
    // Dates are stored and read in UTC, as the records write them.
    timezone: "Z",
  });
}

// Where nothing orders the start (Railway has no depends_on), the database may
// come up after the API: keep trying before giving up.
export async function waitForDatabase(pool: Pool, attempts = 30, delayMs = 2_000): Promise<void> {
  for (let attempt = 1; ; attempt++) {
    try {
      await pool.query("SELECT 1");
      return;
    } catch (error) {
      if (attempt >= attempts) throw error;
      await sleep(delayMs);
    }
  }
}
