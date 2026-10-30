import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { FinishedMatchRecord } from "../../application/FinishedMatchRecord";
import { FinishedMatchRepository } from "../../application/FinishedMatchRepository";

// Output adapter: one JSON file per finished match (RNF-01).
export class JsonFileMatchRepository implements FinishedMatchRepository {
  constructor(private readonly directory: string) {}

  async save(record: FinishedMatchRecord): Promise<void> {
    await mkdir(this.directory, { recursive: true });

    const name = `match-${record.finishedAt.replace(/[:.]/g, "-")}.json`;
    await writeFile(join(this.directory, name), JSON.stringify(record, null, 2), "utf8");
  }
}
