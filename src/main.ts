import { randomBytes } from "node:crypto";
import { Game } from "./application/Game";
import { Lobby } from "./application/Lobby";
import { connect } from "./infrastructure/database/connect";
import { setUpDatabase } from "./infrastructure/database/setup";
import { buildServer } from "./infrastructure/http/server";
import { MySqlMatchRepository } from "./infrastructure/persistence/MySqlMatchRepository";
import { MySqlPlayerRepository } from "./infrastructure/persistence/MySqlPlayerRepository";

// Composition root: many players in one process, one game each. Players and
// finished matches live in MySQL, reached with a user that only reads and
// writes rows; each player's game sees only its matches.
const applied = await setUpDatabase();
const pool = connect();

const lobby = new Lobby(new MySqlPlayerRepository(pool), (player) =>
  new Game({ player, repository: new MySqlMatchRepository(pool, player.id) }),
);

// Without SESSION_SECRET (local development) sessions last until a restart.
const sessionSecret = process.env.SESSION_SECRET ?? randomBytes(32).toString("hex");
if (sessionSecret.length < 32) throw new Error("SESSION_SECRET must have at least 32 characters");

const app = buildServer(lobby, {
  // Behind HTTPS (Railway), the session cookie must only travel over HTTPS.
  secureCookie: process.env.SESSION_COOKIE_SECURE === "true",
  sessionSecret,
});
app.addHook("onClose", () => pool.end());
if (applied.length > 0) app.log.info({ applied }, "migrations applied");
if (!process.env.SESSION_SECRET) app.log.warn("SESSION_SECRET is not set: sessions end on restart");

// In a container the API must listen on every interface ("::" also covers
// IPv6-only private networks); locally, only here.
await app.listen({ port: Number(process.env.PORT ?? 3000), host: process.env.HOST ?? "127.0.0.1" });
