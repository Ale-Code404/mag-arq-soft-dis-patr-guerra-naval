// The console only knows the HTTP API, never the game's code.
export type CellState = "EMPTY" | "SHIP" | "MISS" | "HIT" | "SUNK";
export type Orientation = "HORIZONTAL" | "VERTICAL";
export type Side = "PLAYER" | "OPPONENT";
export type OutcomeType = "MISS" | "HIT" | "SPOTTED" | "CLEAR";
export type Position = { row: number; column: number };
// Row-major: cells[row][column].
export type BoardView = { size: number; cells: CellState[][] };
export type MatchView = {
  phase: "PLACEMENT" | "IN_PROGRESS" | "FINISHED";
  ownBoard: BoardView;
  rivalBoard: BoardView;
  fleet: {
    length: number;
    placed: boolean;
    sunk: boolean;
    origin: Position | null;
    orientation: Orientation | null;
  }[];
  rivalShipsAfloat: number;
  // ammo null means unlimited.
  arsenal: { type: string; ammo: number | null; damaging: boolean }[];
  winner: Side | null;
  turnsPlayed: number;
};
export type TurnView = {
  number: number;
  side: Side;
  weapon: string;
  target: Position;
  outcomes: (Position & { result: OutcomeType })[];
};
export type ActionResult = { ok: true; match: MatchView; turns: TurnView[]; saved?: boolean };
export type MatchConfig = {
  boardSize: number;
  shipLengths: number[];
  difficulty: string;
  firstTurn: string;
  extraTurnOnHit: boolean;
  enabledWeapons: { type: string; ammo: number }[];
};

const baseUrl = process.env.API_URL ?? "http://127.0.0.1:3000";

export type ApiResult<T> = { ok: true; data: T } | { ok: false; reason: string };

async function request<T>(method: string, path: string, body?: unknown): Promise<ApiResult<T>> {
  const response = await fetch(`${baseUrl}/api${path}`, {
    method,
    headers: body === undefined ? undefined : { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  // 204 has no body.
  const data = response.status === 204 ? null : await response.json();
  if (response.ok) return { ok: true, data: data as T };
  return { ok: false, reason: data?.rejection ?? data?.reason ?? data?.message };
}

export const api = {
  getConfig: () => request<MatchConfig>("GET", "/config"),
  configure: (input: Partial<MatchConfig>) => request<MatchConfig>("PUT", "/config", input),
  startMatch: () => request<MatchView>("POST", "/match"),
  getMatch: () => request<MatchView>("GET", "/match"),
  // CU-03, steps 2-4.
  placeShip: (index: number, origin: Position, orientation: Orientation) =>
    request<ActionResult>("PUT", `/match/ships/${index}`, { ...origin, orientation }),
  // CU-03, 5a.
  removeShip: (index: number) => request<ActionResult>("DELETE", `/match/ships/${index}`),
  // CU-03, steps 5-7.
  confirmPlacement: () => request<ActionResult>("POST", "/match/placement"),
  // CU-04.
  fire: (weapon: string, target: Position) =>
    request<ActionResult>("POST", "/match/shots", { weapon, ...target }),
  // CU-06, steps 5-6.
  closeMatch: () => request<null>("DELETE", "/match"),
};
