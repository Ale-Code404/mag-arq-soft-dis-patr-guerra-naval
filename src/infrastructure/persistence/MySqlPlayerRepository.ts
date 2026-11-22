import { createHash, randomBytes, randomUUID } from "node:crypto";
import { Pool, RowDataPacket } from "mysql2/promise";
import { PlayerAccount, PlayerRepository } from "../../application/PlayerRepository";

// 8 random bytes: 16 hex characters, short enough to type, too many to guess.
const CODE_BYTES = 8;

const hash = (code: string) => createHash("sha256").update(code.toLowerCase()).digest("hex");

// Output adapter: the players table (migration 001). Only the hash of each code
// is stored, so a lost code cannot be shown again.
export class MySqlPlayerRepository implements PlayerRepository {
  constructor(private readonly pool: Pool) {}

  async create(name: string): Promise<{ player: PlayerAccount; code: string }> {
    const code = randomBytes(CODE_BYTES).toString("hex");
    const player = { id: randomUUID(), name };

    await this.pool.execute("INSERT INTO players (id, name, code_hash) VALUES (?, ?, ?)", [
      player.id,
      player.name,
      hash(code),
    ]);

    return { player, code };
  }

  async findByCode(code: string): Promise<PlayerAccount | null> {
    if (!/^[0-9a-f]+$/i.test(code)) return null;

    const [rows] = await this.pool.execute<RowDataPacket[]>("SELECT id, name FROM players WHERE code_hash = ?", [
      hash(code),
    ]);
    return rows.length === 0 ? null : { id: rows[0].id, name: rows[0].name };
  }

  async findById(id: string): Promise<PlayerAccount | null> {
    const [rows] = await this.pool.execute<RowDataPacket[]>("SELECT id, name FROM players WHERE id = ?", [id]);
    return rows.length === 0 ? null : { id: rows[0].id, name: rows[0].name };
  }
}
