import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { FinishedMatchRecord } from "../../application/FinishedMatchRecord";
import { FinishedMatchRepository, FinishedMatchSummary } from "../../application/FinishedMatchRepository";

// Ids are file names without extension; anything else could leave the directory.
const VALID_ID = /^[\w-]+$/;

// Output adapter: one JSON file per finished match (RNF-01).
export class JsonFileMatchRepository implements FinishedMatchRepository {
  constructor(private readonly directory: string) {}

  async save(record: FinishedMatchRecord): Promise<void> {
    await mkdir(this.directory, { recursive: true });

    const name = `match-${record.finishedAt.replace(/[:.]/g, "-")}.json`;
    await writeFile(join(this.directory, name), JSON.stringify(record, null, 2), "utf8");
  }

  // CU-09, step 1 and 1a (an empty list).
  async list(): Promise<FinishedMatchSummary[]> {
    let names: string[];
    try {
      names = await readdir(this.directory);
    } catch {
      return [];
    }

    const ids = names.filter((name) => name.endsWith(".json")).map((name) => name.slice(0, -".json".length));
    const summaries = await Promise.all(ids.filter((id) => VALID_ID.test(id)).map((id) => this.summarize(id)));

    return summaries.sort((a, b) => b.id.localeCompare(a.id));
  }

  // CU-09, step 3. A file that is not JSON throws, which the game reports (3a).
  async load(id: string): Promise<unknown> {
    if (!VALID_ID.test(id)) return null;

    let text: string;
    try {
      text = await readFile(join(this.directory, `${id}.json`), "utf8");
    } catch {
      return null;
    }

    return JSON.parse(text);
  }

  private async summarize(id: string): Promise<FinishedMatchSummary> {
    try {
      const data = (await this.load(id)) as Partial<FinishedMatchRecord>;
      return {
        id,
        finishedAt: typeof data?.finishedAt === "string" ? data.finishedAt : null,
        winner: typeof data?.winner === "string" ? data.winner : null,
      };
    } catch {
      return { id, finishedAt: null, winner: null };
    }
  }
}
