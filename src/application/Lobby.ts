import { Game } from "./Game";
import { PlayerAccount, PlayerRepository } from "./PlayerRepository";

const MAX_NAME_LENGTH = 30;
const DEFAULT_IDLE_MS = 60 * 60 * 1000;

export type RegisterResult =
  | { ok: true; player: PlayerAccount; code: string }
  | { ok: false; rejection: "INVALID_NAME" };

export type SignInResult = { ok: true; player: PlayerAccount } | { ok: false; rejection: "INVALID_CODE" };

export type PlayerSession = { player: PlayerAccount; game: Game };

export type LobbyOptions = {
  // A game untouched this long is dropped, with its match in progress.
  idleMs?: number;
  now?: () => number;
};

// Many players in one process, one match each: every player gets its own Game
// (the facade of D-23). The session itself is not kept here: the HTTP layer
// proves who the player is and asks for its game by id. Games are created when
// first needed, so a player whose game was dropped, or who comes back after a
// restart, gets a new one.
export class Lobby {
  private readonly games = new Map<string, PlayerSession & { lastSeen: number }>();
  private readonly idleMs: number;
  private readonly now: () => number;

  constructor(
    private readonly players: PlayerRepository,
    // Supplied by the composition root, so each game gets its own storage.
    private readonly createGame: (player: PlayerAccount) => Game,
    options: LobbyOptions = {},
  ) {
    this.idleMs = options.idleMs ?? DEFAULT_IDLE_MS;
    this.now = options.now ?? Date.now;
  }

  // A new player. The code is how it signs in again, from this or another
  // browser; it is given only once.
  async register(name: unknown): Promise<RegisterResult> {
    const trimmed = typeof name === "string" ? name.trim() : "";
    if (trimmed.length === 0 || trimmed.length > MAX_NAME_LENGTH) return { ok: false, rejection: "INVALID_NAME" };

    const { player, code } = await this.players.create(trimmed);
    return { ok: true, player, code };
  }

  async signIn(code: unknown): Promise<SignInResult> {
    const player = typeof code === "string" ? await this.players.findByCode(code.trim()) : null;
    return player === null ? { ok: false, rejection: "INVALID_CODE" } : { ok: true, player };
  }

  // The game of a player already proven by the session. Null when the player
  // no longer exists.
  async resume(playerId: string): Promise<PlayerSession | null> {
    this.dropIdle();

    const kept = this.games.get(playerId);
    if (kept) {
      kept.lastSeen = this.now();
      return kept;
    }

    const player = await this.players.findById(playerId);
    if (player === null) return null;

    const session = { player, game: this.createGame(player), lastSeen: this.now() };
    this.games.set(player.id, session);
    return session;
  }

  // How many games are in memory.
  get size(): number {
    return this.games.size;
  }

  private dropIdle(): void {
    const oldest = this.now() - this.idleMs;
    for (const [id, session] of this.games) {
      if (session.lastSeen < oldest) this.games.delete(id);
    }
  }
}
