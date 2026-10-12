import Fastify, { FastifyInstance } from "fastify";
import {
  ConfigureMatchInput,
  Difficulty,
  FirstTurn,
  Game,
  MatchConfigRejection,
  WeaponType,
} from "@guerra-naval/core";

// HTTP adapter over the Game facade: it translates requests into facade calls
// and results into status codes. No game rule lives here.
const configureMatchBody = {
  type: "object",
  additionalProperties: false,
  properties: {
    boardSize: { type: "integer" },
    shipLengths: { type: "array", items: { type: "integer" } },
    difficulty: { enum: Object.values(Difficulty) },
    firstTurn: { enum: Object.values(FirstTurn) },
    extraTurnOnHit: { type: "boolean" },
    enabledWeapons: {
      type: "array",
      items: {
        type: "array",
        items: [{ enum: Object.values(WeaponType) }, { type: "integer" }],
        minItems: 2,
        additionalItems: false,
      },
    },
  },
} as const;

export function buildServer(game: Game): FastifyInstance {
  const app = Fastify({ logger: true });

  // CU-02, steps 1-2.
  app.get("/api/config", async () => game.currentConfig());

  // CU-02, steps 3-10.
  app.put<{ Body: ConfigureMatchInput }>(
    "/api/config",
    { schema: { body: configureMatchBody } },
    async (request, reply) => {
      const result = game.configureMatch(request.body);
      if (!result.accepted) {
        const conflict = result.rejection === MatchConfigRejection.MATCH_IN_PROGRESS;
        return reply.code(conflict ? 409 : 422).send(result);
      }
      return result;
    },
  );

  // CU-01, steps 3-4.
  app.post("/api/match", async (_request, reply) => {
    const result = game.startMatch();
    if (!result.started) return reply.code(409).send(result);
    return reply.code(201).send(result.match);
  });

  app.get("/api/match", async (_request, reply) => {
    const match = game.currentMatch();
    if (match === null) return reply.code(404).send({ reason: "NO_MATCH" });
    return match;
  });

  return app;
}
