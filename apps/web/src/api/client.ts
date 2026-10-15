// The view only knows the HTTP API, never the game's code. These types describe
// the JSON the API answers with, so they live here, on the client side.
export type Difficulty = "EASY" | "NORMAL" | "HARD";
export type FirstTurn = "HUMAN" | "BOT" | "RANDOM";
export type WeaponType = "MISSILE" | "BOMB" | "BOMBER" | "TORPEDO" | "RECON_PLANE";
export type CellState = "EMPTY" | "SHIP" | "MISS" | "HIT" | "SUNK";
export type MatchPhase = "PLACEMENT" | "IN_PROGRESS" | "FINISHED";

export type Weapon = { type: WeaponType; ammo: number };

export type MatchConfig = {
  boardSize: number;
  shipLengths: number[];
  difficulty: Difficulty;
  firstTurn: FirstTurn;
  extraTurnOnHit: boolean;
  enabledWeapons: Weapon[];
};

export type ConfigureMatchInput = Partial<MatchConfig>;

export type BoardView = { size: number; cells: CellState[][] };

export type MatchView = {
  phase: MatchPhase;
  ownBoard: BoardView;
  rivalBoard: BoardView;
  fleet: { length: number; placed: boolean; sunk: boolean }[];
  // ammo null means unlimited.
  arsenal: { type: WeaponType; ammo: number | null }[];
};

export type Rejection =
  | "MATCH_IN_PROGRESS"
  | "BOARD_SIZE_OUT_OF_LIMITS"
  | "FLEET_DOES_NOT_FIT"
  | "FLEET_SIZE_OUT_OF_LIMITS"
  | "ARSENAL_AMMO_OUT_OF_LIMITS"
  | "ARSENAL_WEAPONS_NOT_CONFIGURABLE_WEAPONS";

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly reason: string,
  ) {
    super(reason);
  }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const response = await fetch(`/api${path}`, {
    method,
    headers: body === undefined ? undefined : { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await response.json();
  if (!response.ok) {
    throw new ApiError(response.status, data.rejection ?? data.reason ?? data.message);
  }
  return data as T;
}

export const api = {
  getConfig: () => request<MatchConfig>("GET", "/config"),
  configure: (input: ConfigureMatchInput) => request<MatchConfig>("PUT", "/config", input),
  startMatch: () => request<MatchView>("POST", "/match"),
  getMatch: () =>
    request<MatchView>("GET", "/match").catch((error) => {
      if (error instanceof ApiError && error.status === 404) return null;
      throw error;
    }),
};
