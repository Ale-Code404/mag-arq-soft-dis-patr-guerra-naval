import { ConfigRejection } from "../domain/match/ConfigRejection";
import { Difficulty } from "../domain/match/Difficulty";
import { FirstTurn } from "../domain/match/FirstTurn";
import { Match } from "../domain/match/Match";
import { MatchConfig } from "../domain/match/MatchConfig";
import { MatchConfigBuilder, MatchConfigResult } from "../domain/match/MatchConfigBuilder";
import { MatchPhase } from "../domain/match/MatchPhase";

// What the player wants to change. An omitted value keeps the current one (CU-02, 3a).
export type ConfigureMatchInput = {
  boardSize?: number;
  shipLengths?: number[];
  difficulty?: Difficulty;
  firstTurn?: FirstTurn;
  extraTurnOnHit?: boolean;
  enabledWeapons?: [weapon: string, ammo: number][];
};

// Facade: the single entry point the presentation uses, one method per system event.
// It keeps the session state: the current configuration and the match being played.
export class Game {
  private config: MatchConfig;
  private match: Match | null = null;

  constructor(config: MatchConfig = MatchConfig.defaults()) {
    this.config = config;
  }

  // CU-02, steps 1-2: present the current configuration.
  currentConfig(): MatchConfig {
    return this.config;
  }

  // CU-02, steps 3-10. A rejected configuration leaves the current one untouched (9a, 9b, *a).
  configureMatch(input: ConfigureMatchInput): MatchConfigResult {
    if (this.isMatchInProgress()) {
      return { accepted: false, rejection: ConfigRejection.MATCH_IN_PROGRESS };
    }

    const builder = MatchConfigBuilder.from(this.config);

    if (input.boardSize !== undefined) builder.withBoardSize(input.boardSize);
    if (input.shipLengths !== undefined) builder.withShipLengths(input.shipLengths);
    if (input.difficulty !== undefined) builder.withDifficulty(input.difficulty);
    if (input.firstTurn !== undefined) builder.withFirstTurn(input.firstTurn);
    if (input.extraTurnOnHit !== undefined) builder.withExtraTurnOnHit(input.extraTurnOnHit);
    if (input.enabledWeapons !== undefined) builder.withEnabledWeapons(input.enabledWeapons);

    const result = builder.build();

    // Step 10.
    if (result.accepted) {
      this.config = result.config;
    }

    return result;
  }

  private isMatchInProgress(): boolean {
    return this.match !== null && this.match.phase !== MatchPhase.FINISHED;
  }
}
