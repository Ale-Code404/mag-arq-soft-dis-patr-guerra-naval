import type { ConfigureMatchInput, MatchConfig, MatchView } from "@guerra-naval/core";

// Client of the HTTP adapter. The view only knows these calls and plain data.
async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const response = await fetch(`/api${path}`, {
    method,
    headers: body === undefined ? undefined : { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await response.json();
  if (!response.ok) throw new ApiError(response.status, data);
  return data as T;
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly data: { rejection?: string; reason?: string; message?: string },
  ) {
    super(data.rejection ?? data.reason ?? data.message ?? `HTTP ${status}`);
  }
}

export const api = {
  getConfig: () => request<MatchConfig>("GET", "/config"),
  configure: (input: ConfigureMatchInput) =>
    request<{ accepted: true; config: MatchConfig }>("PUT", "/config", input),
  startMatch: () => request<MatchView>("POST", "/match"),
  getMatch: () => request<MatchView>("GET", "/match"),
};
