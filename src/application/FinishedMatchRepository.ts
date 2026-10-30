import { FinishedMatchRecord } from "./FinishedMatchRecord";

// Port for CU-06, step 3: where finished matches are kept (RF-13, RNF-01).
// The application declares it and the infrastructure implements it, so the
// storage format can change without touching the game.
export interface FinishedMatchRepository {
  save(record: FinishedMatchRecord): Promise<void>;
}
