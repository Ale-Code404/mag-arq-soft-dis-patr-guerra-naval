import { Pool } from "mysql2/promise";

const VALID_NAME = /^\w{1,32}$/;

export type AppUser = { user: string; password: string; database: string };

// Run as admin: the API's user exists, has the configured password and may
// only read and write rows of its own database. No CREATE, ALTER, DROP or
// GRANT, so a flaw in the API cannot change the schema or other databases.
export async function provisionAppUser(admin: Pool, { user, password, database }: AppUser): Promise<void> {
  if (!VALID_NAME.test(user) || !VALID_NAME.test(database)) throw new Error("Invalid database or user name");
  if (password.length < 16) throw new Error("DB_PASSWORD must have at least 16 characters");

  await admin.query("CREATE USER IF NOT EXISTS ?@'%' IDENTIFIED BY ?", [user, password]);
  await admin.query("ALTER USER ?@'%' IDENTIFIED BY ?", [user, password]);
  await admin.query(`GRANT SELECT, INSERT, UPDATE, DELETE ON \`${database}\`.* TO ?@'%'`, [user]);
}
