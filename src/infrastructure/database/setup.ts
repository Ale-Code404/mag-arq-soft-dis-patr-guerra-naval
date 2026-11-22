import { connectAdmin, waitForDatabase } from "./connect";
import { migrate } from "./migrate";
import { provisionAppUser } from "./provision";

// On start, as admin: the API's user and the pending migrations. The admin
// connection is closed before the API serves anything.
export async function setUpDatabase(env: NodeJS.ProcessEnv = process.env): Promise<string[]> {
  const admin = connectAdmin(env);
  try {
    await waitForDatabase(admin);
    await provisionAppUser(admin, {
      user: env.DB_USER ?? "",
      password: env.DB_PASSWORD ?? "",
      database: env.DB_NAME ?? "guerra_naval",
    });
    return await migrate(admin);
  } finally {
    await admin.end();
  }
}
