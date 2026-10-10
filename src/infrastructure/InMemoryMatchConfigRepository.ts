import { MatchConfigRepository } from "../application/MatchConfigRepository";
import { MatchConfig } from "../domain/match/MatchConfig";

export class InMemoryMatchConfigRepository implements MatchConfigRepository {
  private current: MatchConfig;

  constructor(initial: MatchConfig) {
    this.current = initial;
  }

  getCurrent(): MatchConfig {
    return this.current;
  }

  saveCurrent(config: MatchConfig): void {
    this.current = config;
  }
}
