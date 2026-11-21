import { FinishedMatchRecord } from "../src/application/FinishedMatchRecord";
import { FinishedMatchRepository, FinishedMatchSummary } from "../src/application/FinishedMatchRepository";
import { Random } from "../src/domain/shared/Random";

// Mulberry32: a small seeded generator, so every run plays the same match.
export function seeded(seed: number): Random {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class InMemoryMatchRepository implements FinishedMatchRepository {
  records: FinishedMatchRecord[] = [];

  async save(record: FinishedMatchRecord): Promise<void> {
    this.records.push(record);
  }

  // The id is the position in the list, so a test can also store raw content.
  stored: unknown[] = [];

  async list(): Promise<FinishedMatchSummary[]> {
    return this.all()
      .map((data, index) => ({ id: String(index), data: data as Partial<FinishedMatchRecord> }))
      .reverse()
      .map(({ id, data }) => ({ id, finishedAt: data.finishedAt ?? null, winner: data.winner ?? null }));
  }

  async load(id: string): Promise<unknown> {
    return this.all()[Number(id)] ?? null;
  }

  private all(): unknown[] {
    return [...this.records, ...this.stored];
  }
}
