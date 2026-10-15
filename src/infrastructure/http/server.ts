import Fastify, { FastifyInstance } from "fastify";
import swagger from "@fastify/swagger";
import { ConfigureMatchInput, Game } from "../../application/Game";
import { MatchConfig } from "../../domain/match/MatchConfig";
import { MatchConfigRejection } from "../../domain/match/MatchConfigRejection";
import { WeaponType } from "../../domain/weapon/WeaponType";
import { schemas } from "./schemas";

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
export async function buildServer(game: Game, logger = true): Promise<FastifyInstance> {
  const app = Fastify({ logger });

  await app.register(swagger, {
    openapi: {
      openapi: "3.1.0",
      info: { title: "Guerra naval", version: "0.1.0" },
    },
    // Keep the schema $id as the component name in the OpenAPI document.
    refResolver: { buildLocalReference: (json, _baseUri, _fragment, i) => String(json.$id ?? `def-${i}`) },
  });

  for (const schema of schemas) app.addSchema(schema);

  // CU-02, steps 1-2.
  app.get(
    "/api/config",
    { schema: { operationId: "getConfig", response: { 200: { $ref: "MatchConfig#" } } } },
    async () => toDto(game.currentConfig()),
  );

  // CU-02, steps 3-10.
  app.put<{ Body: ConfigureMatchBody }>(
    "/api/config",
    {
      schema: {
        operationId: "configureMatch",
        body: { $ref: "ConfigureMatchInput#" },
        response: {
          200: { $ref: "MatchConfig#" },
          409: { $ref: "ConfigRejected#" },
          422: { $ref: "ConfigRejected#" },
        },
      },
    },
    async (request, reply) => {
      const result = game.configureMatch(toInput(request.body));
      if (result.accepted) return toDto(result.config);

      const conflict = result.rejection === MatchConfigRejection.MATCH_IN_PROGRESS;
      return reply.code(conflict ? 409 : 422).send(result);
    },
  );

  // CU-01, steps 3-4.
  app.post(
    "/api/match",
    {
      schema: {
        operationId: "startMatch",
        response: { 201: { $ref: "MatchView#" }, 409: { $ref: "MatchStartRejected#" } },
      },
    },
    async (_request, reply) => {
      const result = game.startMatch();
      if (!result.started) return reply.code(409).send({ reason: result.reason });
      return reply.code(201).send(result.match);
    },
  );

  app.get(
    "/api/match",
    {
      schema: {
        operationId: "getMatch",
        response: { 200: { $ref: "MatchView#" }, 404: { $ref: "NoMatch#" } },
      },
    },
    async (_request, reply) => {
      const match = game.currentMatch();
      if (match === null) return reply.code(404).send({ reason: "NO_MATCH" });
      return match;
    },
  );

  return app;
}
