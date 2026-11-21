import { FinishedMatchRecord } from "./FinishedMatchRecord";

// CU-09, step 1: what the Jugador sees of each saved match before choosing.
export type FinishedMatchSummary = {
  id: string;
  // Null when the saved match cannot be read; choosing it reports 3a.
  finishedAt: string | null;
  winner: string | null;
};

// Port for CU-06, step 3 and CU-09: where finished matches are kept (RF-13,
// RF-14, RNF-01). The application declares it and the infrastructure
// implements it, so the storage format can change without touching the game.
export interface FinishedMatchRepository {
  save(record: FinishedMatchRecord): Promise<void>;
  // Newest first.
  list(): Promise<FinishedMatchSummary[]>;
  // The stored content as it was read, or null if there is no such match. It
  // is untrusted: a file may have been edited by hand, so the game validates it.
  load(id: string): Promise<unknown>;
}
