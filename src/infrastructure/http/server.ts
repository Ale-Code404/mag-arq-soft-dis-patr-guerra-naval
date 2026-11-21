import Fastify, { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { ActionResult, ConfigureMatchInput, Game, ReplayResult } from "../../application/Game";
import { Lobby } from "../../application/Lobby";
import { Orientation } from "../../domain/fleet/Orientation";
import { MatchRejection } from "../../domain/match/MatchRejection";
import { MatchConfig } from "../../domain/match/MatchConfig";
import { MatchConfigRejection } from "../../domain/match/MatchConfigRejection";
import { WeaponType } from "../../domain/weapon/WeaponType";

// Weapons travel as objects, not tuples, so any client can read them.
type WeaponDto = { type: WeaponType; ammo: number };
type ConfigureMatchBody = Omit<ConfigureMatchInput, "enabledWeapons"> & {
  enabledWeapons?: WeaponDto[];
};

function toInput(body: ConfigureMatchBody): ConfigureMatchInput {
  const { enabledWeapons, ...rest } = body;
  return enabledWeapons === undefined
    ? rest
    : { ...rest, enabledWeapons: enabledWeapons.map(({ type, ammo }) => [type, ammo]) };
}

function toDto(config: MatchConfig) {
  return {
    ...config,
    enabledWeapons: config.enabledWeapons.map(([type, ammo]) => ({ type, ammo })),
  };
}

type PlaceShipBody = { row: number; column: number; orientation: Orientation };
type ShotBody = { weapon: WeaponType; row: number; column: number };

// 404 without a match, 409 when the phase does not allow the action, 422 when
// the action breaks a game rule.
function send(reply: FastifyReply, result: ActionResult) {
  if (result.ok) return reply.send(result);

  const status =
    result.rejection === "NO_MATCH" ? 404 : result.rejection === MatchRejection.WRONG_PHASE ? 409 : 422;
  return reply.code(status).send(result);
}

const REPLAY_STATUS = { MATCH_IN_PROGRESS: 409, NOT_FOUND: 404, NO_REPLAY: 404, INVALID_MATCH: 422, NO_SUCH_TURN: 422 };

function sendReplay(reply: FastifyReply, result: ReplayResult) {
  if (result.ok) return reply.send(result.replay);
  return reply.code(REPLAY_STATUS[result.rejection]).send(result);
}

const SESSION_COOKIE = "session";

declare module "fastify" {
  interface FastifyRequest {
    // The Game of the player whose session came with the request.
    game: Game;
  }
}

// Fastify has no cookie parser without a plugin; one cookie needs no plugin.
function sessionToken(request: FastifyRequest): string | undefined {
  const pair = (request.headers.cookie ?? "")
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${SESSION_COOKIE}=`));
  return pair === undefined ? undefined : decodeURIComponent(pair.slice(SESSION_COOKIE.length + 1));
}

// HttpOnly keeps the token away from page scripts; Lax keeps other sites from
// using it to play on the player's behalf.
function sessionCookie(token: string, maxAge?: number): string {
  const expiry = maxAge === undefined ? "" : `; Max-Age=${maxAge}`;
  return `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax${expiry}`;
}

// Input adapter: translates HTTP requests into calls to the Game facade of the
// player in session, and its results into status codes. No game rule lives here.
export function buildServer(lobby: Lobby, { logger = true } = {}): FastifyInstance {
  const app = Fastify({ logger });
  app.decorateRequest("game", null as unknown as Game);

  // Signing in: the same name finds the same player.
  app.post<{ Body: { name: string } }>("/api/session", async (request, reply) => {
    const result = await lobby.signIn(request.body?.name);
    if (!result.ok) return reply.code(422).send(result);

    return reply.header("set-cookie", sessionCookie(result.token)).code(201).send({ player: result.player });
  });

  app.get("/api/session", async (request, reply) => {
    const session = await lobby.resume(sessionToken(request));
    if (session === null) return reply.code(401).send({ reason: "NO_SESSION" });
    return { player: session.player };
  });

  app.delete("/api/session", async (request, reply) => {
    const closed = await lobby.signOut(sessionToken(request));
    return reply.header("set-cookie", sessionCookie("", 0)).code(closed ? 204 : 401).send();
  });

  // Every other route plays on the Game of the player in session.
  app.register(async (scoped) => {
    scoped.addHook("preHandler", async (request, reply) => {
      const session = await lobby.resume(sessionToken(request));
      if (session === null) return reply.code(401).send({ reason: "NO_SESSION" });
      request.game = session.game;
    });

    // CU-02, steps 1-2.
    scoped.get("/api/config", async (request) => toDto(request.game.currentConfig()));

    // CU-02, steps 3-10.
    scoped.put<{ Body: ConfigureMatchBody }>("/api/config", async (request, reply) => {
      const result = request.game.configureMatch(toInput(request.body ?? {}));
      if (result.accepted) return toDto(result.config);

      const conflict = result.rejection === MatchConfigRejection.MATCH_IN_PROGRESS;
      return reply.code(conflict ? 409 : 422).send(result);
    });

    // CU-01, steps 3-4.
    scoped.post("/api/match", async (request, reply) => {
      const result = request.game.startMatch();
      if (!result.started) return reply.code(409).send({ reason: result.reason });
      return reply.code(201).send(result.match);
    });

    scoped.get("/api/match", async (request, reply) => {
      const match = request.game.currentMatch();
      if (match === null) return reply.code(404).send({ reason: "NO_MATCH" });
      return match;
    });

    // CU-03, steps 2-4: place or move one ship of the Jugador.
    scoped.put<{ Params: { index: string }; Body: PlaceShipBody }>(
      "/api/match/ships/:index",
      async (request, reply) => {
        const { row, column, orientation } = request.body ?? {};
        return send(reply, request.game.placeShip(Number(request.params.index), row, column, orientation));
      },
    );

    // CU-03, 5a.
    scoped.delete<{ Params: { index: string } }>("/api/match/ships/:index", async (request, reply) =>
      send(reply, request.game.removeShip(Number(request.params.index))),
    );

    // CU-03, steps 5-7, and CU-01, steps 6-7.
    scoped.post("/api/match/placement", async (request, reply) => send(reply, request.game.confirmPlacement()));

    // CU-04, with CU-12 and CU-06.
    scoped.post<{ Body: ShotBody }>("/api/match/shots", async (request, reply) => {
      const { weapon, row, column } = request.body ?? {};
      return send(reply, await request.game.fire(weapon, row, column));
    });

    // CU-07, steps 1-4.
    scoped.get("/api/match/statistics", async (request, reply) => {
      const result = request.game.statistics();
      if (result.ok) return result.statistics;
      return reply.code(result.rejection === "NO_MATCH" ? 404 : 409).send(result);
    });

    // CU-06, steps 5-6, or cancelling a match.
    scoped.delete("/api/match", async (request, reply) =>
      request.game.closeMatch() ? reply.code(204).send() : reply.code(404).send({ reason: "NO_MATCH" }),
    );

    // CU-09, step 1.
    scoped.get("/api/matches", async (request) => request.game.listFinishedMatches());

    // CU-10, steps 1-3, including CU-09 steps 2-4.
    scoped.post<{ Body: { id: string } }>("/api/replay", async (request, reply) =>
      sendReplay(reply, await request.game.loadFinishedMatch(String(request.body?.id ?? ""))),
    );

    // CU-10, step 5, 4a1 and 4a2: the state after the first `turn` turns.
    scoped.get<{ Params: { turn: string } }>("/api/replay/turns/:turn", async (request, reply) =>
      sendReplay(reply, request.game.replayAt(Number(request.params.turn))),
    );

    // CU-10, steps 6-7.
    scoped.delete("/api/replay", async (request, reply) =>
      request.game.closeReplay() ? reply.code(204).send() : reply.code(404).send({ reason: "NO_REPLAY" }),
    );
  });

  return app;
}
