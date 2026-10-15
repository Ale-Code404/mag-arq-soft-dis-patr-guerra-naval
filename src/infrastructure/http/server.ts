import Fastify, { FastifyInstance } from "fastify";
import { ConfigureMatchInput, Game } from "../../application/Game";
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

  return app;
}
