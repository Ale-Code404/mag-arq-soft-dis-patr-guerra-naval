import { createPool, Pool } from "mysql2/promise";

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
