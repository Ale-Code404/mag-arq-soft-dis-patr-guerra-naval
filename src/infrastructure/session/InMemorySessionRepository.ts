import { randomBytes } from "node:crypto";
import { SessionRepository } from "../../application/SessionRepository";

// Output adapter: sessions last while the process runs. After a restart the
// player signs in again with the same name and finds its saved matches.
export class InMemorySessionRepository implements SessionRepository {
  private readonly sessions = new Map<string, string>();

  async open(playerId: string): Promise<string> {
    // Unguessable, so a token cannot be forged to take another player's game.
    const token = randomBytes(32).toString("base64url");
    this.sessions.set(token, playerId);
    return token;
  }

  async find(token: string): Promise<string | null> {
    return this.sessions.get(token) ?? null;
  }

  async close(token: string): Promise<void> {
    this.sessions.delete(token);
  }
}
