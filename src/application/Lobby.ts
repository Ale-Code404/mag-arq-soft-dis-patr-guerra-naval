import { Game } from "./Game";
import { PlayerAccount, PlayerRepository } from "./PlayerRepository";
import { SessionRepository } from "./SessionRepository";

const MAX_NAME_LENGTH = 30;

export type SignInResult =
  | { ok: true; token: string; player: PlayerAccount }
  | { ok: false; rejection: "INVALID_NAME" };

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

  // The same name always finds the same player; a new name creates one.
  async signIn(name: string): Promise<SignInResult> {
    const trimmed = typeof name === "string" ? name.trim() : "";
    if (trimmed.length === 0 || trimmed.length > MAX_NAME_LENGTH) return { ok: false, rejection: "INVALID_NAME" };

    const player = (await this.players.findByName(trimmed)) ?? (await this.players.create(trimmed));
    if (!this.games.has(player.id)) this.games.set(player.id, { player, game: this.createGame(player) });

    return { ok: true, token: await this.sessions.open(player.id), player };
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
}
