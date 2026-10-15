import { writeFile } from "node:fs/promises";
import { Game } from "../../application/Game";
import { buildServer } from "./server";

// Writes the HTTP contract to openapi.json, the only thing a client needs.
const app = await buildServer(new Game(), false);
await app.ready();
await writeFile("openapi.json", JSON.stringify(app.swagger(), null, 2) + "\n");
await app.close();
console.log("openapi.json written");
