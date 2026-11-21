import { createHash, randomBytes, randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { PlayerAccount, PlayerRepository } from "../../application/PlayerRepository";

// 8 random bytes: 16 hex characters, short enough to type, too many to guess.
const CODE_BYTES = 8;

type StoredPlayer = PlayerAccount & { codeHash: string };

const hash = (code: string) => createHash("sha256").update(code.toLowerCase()).digest("hex");

// Output adapter: every player in one JSON file (RNF-01). Only the hash of each
// code is written, so reading the file does not let anyone sign in as another
// player; for the same reason a lost code cannot be shown again.
export class JsonFilePlayerRepository implements PlayerRepository {
  // Serializes writes, so two players created at once are both kept.
  private pending: Promise<unknown> = Promise.resolve();

  constructor(private readonly file: string) {}

  create(name: string): Promise<{ player: PlayerAccount; code: string }> {
    const created = this.pending.then(async () => {
      const code = randomBytes(CODE_BYTES).toString("hex");
      const player = { id: randomUUID(), name };

      const players = await this.readAll();
      await mkdir(dirname(this.file), { recursive: true });
      await writeFile(this.file, JSON.stringify([...players, { ...player, codeHash: hash(code) }], null, 2), "utf8");

      return { player, code };
    });
    this.pending = created.catch(() => undefined);
    return created;
  }

  async findByCode(code: string): Promise<PlayerAccount | null> {
    if (!/^[0-9a-f]+$/i.test(code)) return null;

    const wanted = hash(code);
    const found = (await this.readAll()).find((player) => player.codeHash === wanted);
    return found === undefined ? null : { id: found.id, name: found.name };
  }

  private async readAll(): Promise<StoredPlayer[]> {
    try {
      return JSON.parse(await readFile(this.file, "utf8")) as StoredPlayer[];
    } catch {
      return [];
    }
  }
}
