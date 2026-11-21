import { join } from "node:path";
import { Game } from "./application/Game";
import { Lobby } from "./application/Lobby";
import { buildServer } from "./infrastructure/http/server";
import { JsonFileMatchRepository } from "./infrastructure/persistence/JsonFileMatchRepository";
import { JsonFilePlayerRepository } from "./infrastructure/persistence/JsonFilePlayerRepository";
import { InMemorySessionRepository } from "./infrastructure/session/InMemorySessionRepository";

// Composition root: many players in one process, one game each. Every player
// saves its finished matches in a folder of its own, so it only sees those.
const matchesDir = process.env.MATCHES_DIR ?? "data/matches";
const players = new JsonFilePlayerRepository(process.env.PLAYERS_FILE ?? "data/players.json");

const lobby = new Lobby(players, new InMemorySessionRepository(), (player) =>
  new Game({ player, repository: new JsonFileMatchRepository(join(matchesDir, player.id)) }),
);

const app = buildServer(lobby);
const port = Number(process.env.PORT ?? 3000);

await app.listen({ port, host: "127.0.0.1" });
