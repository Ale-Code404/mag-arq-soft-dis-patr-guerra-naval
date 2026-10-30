// The view only knows the HTTP API, never the game's code. These types describe
// the JSON the API answers with, so they live here, on the client side.
export type Difficulty = "EASY" | "NORMAL" | "HARD";
export type FirstTurn = "HUMAN" | "BOT" | "RANDOM";
export type WeaponType = "MISSILE" | "BOMB" | "BOMBER" | "TORPEDO" | "RECON_PLANE";
export type CellState = "EMPTY" | "SHIP" | "MISS" | "HIT" | "SUNK";
export type MatchPhase = "PLACEMENT" | "IN_PROGRESS" | "FINISHED";
export type Orientation = "HORIZONTAL" | "VERTICAL";
export type Side = "PLAYER" | "OPPONENT";
export type OutcomeType = "MISS" | "HIT" | "SPOTTED" | "CLEAR";

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

export type Position = { row: number; column: number };

// Row-major: cells[row][column].
export type BoardView = { size: number; cells: CellState[][] };

export type ShipView = {
  length: number;
  placed: boolean;
  sunk: boolean;
  origin: Position | null;
  orientation: Orientation | null;
};

export type MatchView = {
  phase: MatchPhase;
  ownBoard: BoardView;
  rivalBoard: BoardView;
  fleet: ShipView[];
  rivalShipsAfloat: number;
  // ammo null means unlimited.
  arsenal: { type: WeaponType; ammo: number | null; damaging: boolean }[];
  winner: Side | null;
  turnsPlayed: number;
};

export type TurnView = {
  number: number;
  side: Side;
  weapon: WeaponType;
  target: Position;
  outcomes: (Position & { result: OutcomeType })[];
};

// Answer of every action on a match (CU-03, CU-04, CU-06).
export type ActionResult = { ok: true; match: MatchView; turns: TurnView[]; saved?: boolean };

export type Rejection =
  | "MATCH_IN_PROGRESS"
  | "INVALID_VALUE"
  | "BOARD_SIZE_OUT_OF_LIMITS"
  | "FLEET_DOES_NOT_FIT"
  | "FLEET_SIZE_OUT_OF_LIMITS"
  | "ARSENAL_AMMO_OUT_OF_LIMITS"
  | "ARSENAL_WEAPONS_NOT_CONFIGURABLE_WEAPONS"
  | "NO_MATCH"
  | "WRONG_PHASE"
  | "OUT_OF_BOARD"
  | "OVERLAP"
  | "UNKNOWN_SHIP"
  | "UNKNOWN_ORIENTATION"
  | "FLEET_NOT_PLACED"
  | "OPPONENT_PLACEMENT_FAILED"
  | "UNKNOWN_WEAPON"
  | "NO_SHOT"
  | "NO_AMMO"
  | "AREA_OUT_OF_BOARD"
  | "AREA_ALREADY_ATTACKED";

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
  // 204 has no body.
  const data = response.status === 204 ? null : await response.json();
  if (!response.ok) {
    throw new ApiError(response.status, data?.rejection ?? data?.reason ?? data?.message);
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
  // CU-03, steps 2-4.
  placeShip: (index: number, origin: Position, orientation: Orientation) =>
    request<ActionResult>("PUT", `/match/ships/${index}`, { ...origin, orientation }),
  // CU-03, 5a.
  removeShip: (index: number) => request<ActionResult>("DELETE", `/match/ships/${index}`),
  // CU-03, steps 5-7.
  confirmPlacement: () => request<ActionResult>("POST", "/match/placement"),
  // CU-04.
  fire: (weapon: WeaponType, target: Position) =>
    request<ActionResult>("POST", "/match/shots", { weapon, ...target }),
  // CU-06, steps 5-6.
  closeMatch: () => request<null>("DELETE", "/match"),
};
