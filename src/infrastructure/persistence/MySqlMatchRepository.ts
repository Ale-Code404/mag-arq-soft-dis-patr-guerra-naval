import { randomUUID } from "node:crypto";
import { Pool, RowDataPacket } from "mysql2/promise";
import { FinishedMatchRecord } from "../../application/FinishedMatchRecord";
import { FinishedMatchRepository, FinishedMatchSummary } from "../../application/FinishedMatchRepository";

// Output adapter: the matches table (migration 002), seen by one player only.
// The composition root gives each player's Game its own instance, so a player
// can neither list nor load another player's matches.
export class MySqlMatchRepository implements FinishedMatchRepository {
  constructor(
    private readonly pool: Pool,
    private readonly playerId: string,
  ) {}

  // CU-06, step 3: the record stays whole, as JSON (RNF-01).
  async save(record: FinishedMatchRecord): Promise<void> {
    await this.pool.execute(
      "INSERT INTO matches (id, player_id, finished_at, winner, record) VALUES (?, ?, ?, ?, ?)",
      [randomUUID(), this.playerId, new Date(record.finishedAt), record.winner, JSON.stringify(record)],
    );
  }

  // CU-09, step 1 and 1a. Newest first.
  async list(): Promise<FinishedMatchSummary[]> {
    const [rows] = await this.pool.execute<RowDataPacket[]>(
      "SELECT id, finished_at, winner FROM matches WHERE player_id = ? ORDER BY finished_at DESC",
      [this.playerId],
    );
    return rows.map((row) => ({
      id: row.id,
      finishedAt: (row.finished_at as Date).toISOString(),
      winner: row.winner,
    }));
  }

  // CU-09, step 3: the record as stored; the game validates it.
  async load(id: string): Promise<unknown> {
    const [rows] = await this.pool.execute<RowDataPacket[]>(
      "SELECT record FROM matches WHERE id = ? AND player_id = ?",
      [id, this.playerId],
    );
    return rows.length === 0 ? null : rows[0].record;
  }
}
