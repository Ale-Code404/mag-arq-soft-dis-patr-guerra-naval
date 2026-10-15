import { Game } from "./application/Game";
import { buildServer } from "./infrastructure/http/server";

// Composition root: one local player, so one game per process.
const app = await buildServer(new Game());
const port = Number(process.env.PORT ?? 3000);

await app.listen({ port, host: "127.0.0.1" });
