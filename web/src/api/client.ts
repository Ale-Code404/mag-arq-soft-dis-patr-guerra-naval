import createClient from "openapi-fetch";
import type { components, paths } from "./contract";

// The view only knows the HTTP contract (openapi.json), never the game's code.
// Regenerate contract.d.ts with `npm run contract` when the API changes.
export type MatchConfig = components["schemas"]["MatchConfig"];
export type ConfigureMatchInput = components["schemas"]["ConfigureMatchInput"];
export type MatchView = components["schemas"]["MatchView"];
export type BoardView = components["schemas"]["BoardView"];
export type CellState = BoardView["cells"][number][number];
export type WeaponType = MatchView["arsenal"][number]["type"];
export type Difficulty = MatchConfig["difficulty"];
export type FirstTurn = MatchConfig["firstTurn"];
export type Rejection =
  | components["schemas"]["ConfigRejected"]["rejection"]
  | components["schemas"]["MatchStartRejected"]["reason"];

const http = createClient<paths>({ baseUrl: "/" });

export class ApiError extends Error {
  constructor(readonly reason: string) {
    super(reason);
  }
}

function reasonOf(error: unknown): string {
  if (typeof error === "object" && error !== null) {
    const body = error as { rejection?: string; reason?: string; message?: string };
    return body.rejection ?? body.reason ?? body.message ?? "UNKNOWN";
  }
  return "UNKNOWN";
}

export const api = {
  async getConfig(): Promise<MatchConfig> {
    const { data, error } = await http.GET("/api/config");
    if (data === undefined) throw new ApiError(reasonOf(error));
    return data;
  },

  async configure(input: ConfigureMatchInput): Promise<MatchConfig> {
    const { data, error } = await http.PUT("/api/config", { body: input });
    if (data === undefined) throw new ApiError(reasonOf(error));
    return data;
  },

  async startMatch(): Promise<MatchView> {
    const { data, error } = await http.POST("/api/match");
    if (data === undefined) throw new ApiError(reasonOf(error));
    return data;
  },

  async getMatch(): Promise<MatchView | null> {
    const { data, response } = await http.GET("/api/match");
    if (response.status === 404) return null;
    return data ?? null;
  },
};
