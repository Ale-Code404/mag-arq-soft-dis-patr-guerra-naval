import { FinishedMatchRecord } from "../src/application/FinishedMatchRecord";
import { FinishedMatchRepository } from "../src/application/FinishedMatchRepository";
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
}
