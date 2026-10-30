import Fastify, { FastifyInstance, FastifyReply } from "fastify";
import { ActionResult, ConfigureMatchInput, Game } from "../../application/Game";
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

// Input adapter: translates HTTP requests into calls to the Game facade, and
// its results into status codes. No game rule lives here.
export function buildServer(game: Game): FastifyInstance {
  const app = Fastify({ logger: true });

  // CU-02, steps 1-2.
  app.get("/api/config", async () => toDto(game.currentConfig()));

  // CU-02, steps 3-10.
  app.put<{ Body: ConfigureMatchBody }>("/api/config", async (request, reply) => {
    const result = game.configureMatch(toInput(request.body ?? {}));
    if (result.accepted) return toDto(result.config);

    const conflict = result.rejection === MatchConfigRejection.MATCH_IN_PROGRESS;
    return reply.code(conflict ? 409 : 422).send(result);
  });

  // CU-01, steps 3-4.
  app.post("/api/match", async (_request, reply) => {
    const result = game.startMatch();
    if (!result.started) return reply.code(409).send({ reason: result.reason });
    return reply.code(201).send(result.match);
  });

  app.get("/api/match", async (_request, reply) => {
    const match = game.currentMatch();
    if (match === null) return reply.code(404).send({ reason: "NO_MATCH" });
    return match;
  });

  // CU-03, steps 2-4: place or move one ship of the Jugador.
  app.put<{ Params: { index: string }; Body: PlaceShipBody }>(
    "/api/match/ships/:index",
    async (request, reply) => {
      const { row, column, orientation } = request.body ?? {};
      return send(reply, game.placeShip(Number(request.params.index), row, column, orientation));
    },
  );

  // CU-03, 5a.
  app.delete<{ Params: { index: string } }>("/api/match/ships/:index", async (request, reply) =>
    send(reply, game.removeShip(Number(request.params.index))),
  );

  // CU-03, steps 5-7, and CU-01, steps 6-7.
  app.post("/api/match/placement", async (_request, reply) => send(reply, game.confirmPlacement()));

  // CU-04, with CU-12 and CU-06.
  app.post<{ Body: ShotBody }>("/api/match/shots", async (request, reply) => {
    const { weapon, row, column } = request.body ?? {};
    return send(reply, await game.fire(weapon, row, column));
  });

  // CU-06, steps 5-6, or cancelling a match.
  app.delete("/api/match", async (_request, reply) =>
    game.closeMatch() ? reply.code(204).send() : reply.code(404).send({ reason: "NO_MATCH" }),
  );

  return app;
}
