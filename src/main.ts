import { Game } from "./application/Game";
import { buildServer } from "./infrastructure/http/server";
import { JsonFileMatchRepository } from "./infrastructure/persistence/JsonFileMatchRepository";

// Composition root: one local player, so one game per process.
const repository = new JsonFileMatchRepository(process.env.MATCHES_DIR ?? "data/matches");
const app = buildServer(new Game({ repository }));
const port = Number(process.env.PORT ?? 3000);

await app.listen({ port, host: "127.0.0.1" });
