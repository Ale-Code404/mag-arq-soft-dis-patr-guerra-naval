// The console only knows the HTTP API, never the game's code.
export type CellState = "EMPTY" | "SHIP" | "MISS" | "HIT" | "SUNK";
export type BoardView = { size: number; cells: CellState[][] };
export type MatchView = {
  phase: string;
  ownBoard: BoardView;
  rivalBoard: BoardView;
  fleet: { length: number; placed: boolean; sunk: boolean }[];
  arsenal: { type: string; ammo: number | null }[];
};
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
  const data = await response.json();
  if (response.ok) return { ok: true, data: data as T };
  return { ok: false, reason: data.rejection ?? data.reason ?? data.message };
}

export const api = {
  getConfig: () => request<MatchConfig>("GET", "/config"),
  configure: (input: Partial<MatchConfig>) => request<MatchConfig>("PUT", "/config", input),
  startMatch: () => request<MatchView>("POST", "/match"),
  getMatch: () => request<MatchView>("GET", "/match"),
};
