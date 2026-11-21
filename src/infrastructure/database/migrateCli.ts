import { connect } from "./connect";
import { migrate } from "./migrate";

// npm run migrate: applies the pending migrations without starting the API.
const pool = connect();
try {
  const applied = await migrate(pool);
  console.log(applied.length === 0 ? "No pending migrations." : `Applied: ${applied.join(", ")}`);
} finally {
  await pool.end();
}
