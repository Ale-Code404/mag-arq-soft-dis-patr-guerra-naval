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
  sunkShips: { length: number }[];
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

// CU-09, step 1. Null fields: the saved match cannot be read.
export type FinishedMatchSummary = { id: string; finishedAt: string | null; winner: Side | null };
// CU-10: both fleets are visible; turn 0 is the initial state.
export type ReplayView = {
  id: string;
  finishedAt: string;
  winner: Side;
  turn: number;
  totalTurns: number;
  playerBoard: BoardView;
  opponentBoard: BoardView;
  lastTurn: TurnView | null;
};
// CU-07. precision null means «sin disparos» (2a).
export type MatchStatistics = {
  precision: number | null;
  hits: number;
  damagingShots: number;
  turns: { total: number; player: number; opponent: number };
  shipsSunk: { player: number; opponent: number };
};

export type PlayerAccount = { id: string; name: string };

const baseUrl = process.env.API_URL ?? "http://127.0.0.1:3000";

// Node's fetch keeps no cookies, so the session cookie is kept here and sent
// back like a browser would.
let sessionCookie: string | undefined;

export type ApiResult<T> = { ok: true; data: T } | { ok: false; reason: string };

async function request<T>(method: string, path: string, body?: unknown): Promise<ApiResult<T>> {
  const headers: Record<string, string> = {};
  if (body !== undefined) headers["content-type"] = "application/json";
  if (sessionCookie) headers.cookie = sessionCookie;

  const response = await fetch(`${baseUrl}/api${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const setCookie = response.headers.get("set-cookie");
  if (setCookie) sessionCookie = setCookie.split(";")[0];
  // 204 has no body.
  const data = response.status === 204 ? null : await response.json();
  if (response.ok) return { ok: true, data: data as T };
  return { ok: false, reason: data?.rejection ?? data?.reason ?? data?.message };
}

export const api = {
  // A new player; its code comes only in this answer.
  register: (name: string) => request<{ player: PlayerAccount; code: string }>("POST", "/players", { name }),
  // The code finds the player and its match.
  signIn: (code: string) => request<{ player: PlayerAccount }>("POST", "/session", { code }),
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
  // CU-07.
  getStatistics: () => request<MatchStatistics>("GET", "/match/statistics"),
  // CU-09, step 1.
  listMatches: () => request<FinishedMatchSummary[]>("GET", "/matches"),
  // CU-10, steps 1-3 (with CU-09, steps 2-4).
  loadReplay: (id: string) => request<ReplayView>("POST", "/replay", { id }),
  // CU-10, step 5, 4a1 and 4a2.
  replayAt: (turn: number) => request<ReplayView>("GET", `/replay/turns/${turn}`),
  // CU-10, steps 6-7.
  closeReplay: () => request<null>("DELETE", "/replay"),
};
