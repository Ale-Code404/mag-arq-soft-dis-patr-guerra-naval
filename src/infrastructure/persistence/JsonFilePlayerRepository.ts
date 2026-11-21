import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { PlayerAccount, PlayerRepository } from "../../application/PlayerRepository";

const normalize = (name: string) => name.trim().toLocaleLowerCase();

// Output adapter: every player in one JSON file (RNF-01). Players are few and
// written once, so the whole file is read and rewritten each time.
export class JsonFilePlayerRepository implements PlayerRepository {
  // Serializes writes, so two sign-ins at once do not lose a player.
  private pending: Promise<unknown> = Promise.resolve();

  constructor(private readonly file: string) {}

  async findByName(name: string): Promise<PlayerAccount | null> {
    const players = await this.readAll();
    return players.find((player) => normalize(player.name) === normalize(name)) ?? null;
  }

  create(name: string): Promise<PlayerAccount> {
    const created = this.pending.then(async () => {
      const players = await this.readAll();
      const existing = players.find((player) => normalize(player.name) === normalize(name));
      if (existing) return existing;

      const player = { id: randomUUID(), name: name.trim() };
      await mkdir(dirname(this.file), { recursive: true });
      await writeFile(this.file, JSON.stringify([...players, player], null, 2), "utf8");
      return player;
    });
    this.pending = created.catch(() => undefined);
    return created;
  }

  private async readAll(): Promise<PlayerAccount[]> {
    try {
      return JSON.parse(await readFile(this.file, "utf8")) as PlayerAccount[];
    } catch {
      return [];
    }
  }
}
