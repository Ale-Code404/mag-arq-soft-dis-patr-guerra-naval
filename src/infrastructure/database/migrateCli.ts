import { setUpDatabase } from "./setup";

// npm run migrate: the API's user and the pending migrations, without the API.
const applied = await setUpDatabase();
console.log(applied.length === 0 ? "No pending migrations." : `Applied: ${applied.join(", ")}`);
