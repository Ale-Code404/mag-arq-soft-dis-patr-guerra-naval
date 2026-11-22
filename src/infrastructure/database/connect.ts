import { createPool, Pool } from "mysql2/promise";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Two users: the API runs as DB_USER, which may only read and write rows; the
// admin (DB_ADMIN_USER, root) only creates that user and migrates, on start.
// Settings come from the environment, never from the code.
function pool(env: NodeJS.ProcessEnv, user: string | undefined, password: string | undefined, size: number): Pool {
  return createPool({
    host: env.DB_HOST ?? "127.0.0.1",
    port: Number(env.DB_PORT ?? 3306),
    user,
    password,
    database: env.DB_NAME ?? "guerra_naval",
    connectionLimit: size,
    // Dates are stored and read in UTC, as the records write them.
    timezone: "Z",
  });
}

export function connect(env: NodeJS.ProcessEnv = process.env): Pool {
  return pool(env, env.DB_USER, env.DB_PASSWORD, Number(env.DB_POOL_SIZE ?? 10));
}

export function connectAdmin(env: NodeJS.ProcessEnv = process.env): Pool {
  return pool(env, env.DB_ADMIN_USER, env.DB_ADMIN_PASSWORD, 1);
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
