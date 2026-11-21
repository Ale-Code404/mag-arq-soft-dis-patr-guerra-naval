import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { Pool, RowDataPacket } from "mysql2/promise";

const MIGRATIONS_DIR = join(fileURLToPath(new URL(".", import.meta.url)), "migrations");

// Applies, in name order, every .sql file of migrations/ not yet recorded in
// schema_migrations. Each file is one statement and runs once; a lock keeps two
// API processes starting together from applying the same file twice.
export async function migrate(pool: Pool): Promise<string[]> {
  const connection = await pool.getConnection();
  try {
    await connection.query("SELECT GET_LOCK('guerra_naval_migrations', 30)");
    await connection.query(
      `CREATE TABLE IF NOT EXISTS schema_migrations (
         name VARCHAR(255) NOT NULL PRIMARY KEY,
         applied_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
       )`,
    );

    const [rows] = await connection.query<RowDataPacket[]>("SELECT name FROM schema_migrations");
    const applied = new Set(rows.map((row) => row.name as string));
    const pending = (await readdir(MIGRATIONS_DIR)).filter((name) => name.endsWith(".sql") && !applied.has(name)).sort();

    for (const name of pending) {
      await connection.query(await readFile(join(MIGRATIONS_DIR, name), "utf8"));
      await connection.query("INSERT INTO schema_migrations (name) VALUES (?)", [name]);
    }

    return pending;
  } finally {
    await connection.query("SELECT RELEASE_LOCK('guerra_naval_migrations')").catch(() => undefined);
    connection.release();
  }
}
