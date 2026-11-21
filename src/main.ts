import { Game } from "./application/Game";
import { Lobby } from "./application/Lobby";
import { connect } from "./infrastructure/database/connect";
import { migrate } from "./infrastructure/database/migrate";
import { buildServer } from "./infrastructure/http/server";
import { MySqlMatchRepository } from "./infrastructure/persistence/MySqlMatchRepository";
import { MySqlPlayerRepository } from "./infrastructure/persistence/MySqlPlayerRepository";
import { InMemorySessionRepository } from "./infrastructure/session/InMemorySessionRepository";

// Composition root: many players in one process, one game each. Players and
// finished matches live in MySQL; each player's game sees only its matches.
const pool = connect();
const applied = await migrate(pool);

const lobby = new Lobby(new MySqlPlayerRepository(pool), new InMemorySessionRepository(), (player) =>
  new Game({ player, repository: new MySqlMatchRepository(pool, player.id) }),
);

const app = buildServer(lobby);
app.addHook("onClose", () => pool.end());
if (applied.length > 0) app.log.info({ applied }, "migrations applied");

// In a container the API must listen on every interface; locally, only here.
await app.listen({ port: Number(process.env.PORT ?? 3000), host: process.env.HOST ?? "127.0.0.1" });
