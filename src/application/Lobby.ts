import { Game } from "./Game";
import { PlayerAccount, PlayerRepository } from "./PlayerRepository";
import { SessionRepository } from "./SessionRepository";

const MAX_NAME_LENGTH = 30;

export type RegisterResult =
  | { ok: true; token: string; player: PlayerAccount; code: string }
  | { ok: false; rejection: "INVALID_NAME" };

export type SignInResult =
  | { ok: true; token: string; player: PlayerAccount }
  | { ok: false; rejection: "INVALID_CODE" };

export type PlayerSession = { player: PlayerAccount; game: Game };

// Many players in one process, one match each: every player gets its own Game
// (the facade of D-23), found through the session the client presents. The
// games live in memory, as the matches in progress always did.
export class Lobby {
  private readonly games = new Map<string, PlayerSession>();

  constructor(
    private readonly players: PlayerRepository,
    private readonly sessions: SessionRepository,
    // Supplied by the composition root, so each game gets its own storage.
    private readonly createGame: (player: PlayerAccount) => Game,
  ) {}

  // A new player and its first session. The code is how it signs in again,
  // from this or another browser; it is given only once.
  async register(name: unknown): Promise<RegisterResult> {
    const trimmed = typeof name === "string" ? name.trim() : "";
    if (trimmed.length === 0 || trimmed.length > MAX_NAME_LENGTH) return { ok: false, rejection: "INVALID_NAME" };

    const { player, code } = await this.players.create(trimmed);
    return { ok: true, token: await this.open(player), player, code };
  }

  // The code finds the player and its match, if one is in progress.
  async signIn(code: unknown): Promise<SignInResult> {
    const player = typeof code === "string" ? await this.players.findByCode(code.trim()) : null;
    if (player === null) return { ok: false, rejection: "INVALID_CODE" };

    return { ok: true, token: await this.open(player), player };
  }

  // Null when the token is unknown or its session was closed.
  async resume(token: string | undefined): Promise<PlayerSession | null> {
    if (!token) return null;

    const playerId = await this.sessions.find(token);
    return playerId === null ? null : (this.games.get(playerId) ?? null);
  }

  // Closes this session only; the player's match stays for its other sessions.
  async signOut(token: string | undefined): Promise<boolean> {
    if (!token || (await this.sessions.find(token)) === null) return false;

    await this.sessions.close(token);
    return true;
  }

  private async open(player: PlayerAccount): Promise<string> {
    if (!this.games.has(player.id)) this.games.set(player.id, { player, game: this.createGame(player) });
    return this.sessions.open(player.id);
  }
}
