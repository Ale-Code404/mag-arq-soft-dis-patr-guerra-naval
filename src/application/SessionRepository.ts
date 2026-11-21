// Port: which player each open session belongs to. The token is what the
// client keeps (a cookie on the web); it says nothing about the player.
export interface SessionRepository {
  open(playerId: string): Promise<string>;
  find(token: string): Promise<string | null>;
  close(token: string): Promise<void>;
}
