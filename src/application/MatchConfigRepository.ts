import { MatchConfig } from "../domain/match/MatchConfig";

// Where the current configuration lives between CU-02 and CU-01.
export interface MatchConfigRepository {
  getCurrent(): MatchConfig;
  saveCurrent(config: MatchConfig): void;
}
