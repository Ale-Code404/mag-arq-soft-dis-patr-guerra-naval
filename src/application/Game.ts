import { MatchConfigRejection } from "../domain/match/MatchConfigRejection";
import { Difficulty } from "../domain/match/Difficulty";
import { FirstTurn } from "../domain/match/FirstTurn";
import { Match } from "../domain/match/Match";
import { MatchConfig, MatchConfigResult } from "../domain/match/MatchConfig";
import { MatchConfigBuilder } from "../domain/match/MatchConfigBuilder";
import { MatchPhase } from "../domain/match/MatchPhase";

export type ConfigureMatchInput = {
  boardSize?: number;
  shipLengths?: number[];
  difficulty?: Difficulty;
  firstTurn?: FirstTurn;
  extraTurnOnHit?: boolean;
  enabledWeapons?: [weapon: string, ammo: number][];
};

export class Game {
  private config: MatchConfig;
  private match: Match | null = null;

  constructor(config: MatchConfig = MatchConfig.defaults()) {
    this.config = config;
  }

  currentConfig(): MatchConfig {
    return this.config;
  }

  configureMatch(input: ConfigureMatchInput): MatchConfigResult {
    if (this.isMatchInProgress()) {
      return {
        accepted: false,
        rejection: MatchConfigRejection.MATCH_IN_PROGRESS,
      };
    }

    const builder = MatchConfigBuilder.from(this.config);

    if (input.boardSize !== undefined) builder.withBoardSize(input.boardSize);
    if (input.shipLengths !== undefined)
      builder.withShipLengths(input.shipLengths);
    if (input.difficulty !== undefined)
      builder.withDifficulty(input.difficulty);
    if (input.firstTurn !== undefined) builder.withFirstTurn(input.firstTurn);
    if (input.extraTurnOnHit !== undefined)
      builder.withExtraTurnOnHit(input.extraTurnOnHit);
    if (input.enabledWeapons !== undefined)
      builder.withEnabledWeapons(input.enabledWeapons);

    const result = builder.build();

    if (result.accepted) {
      this.config = result.config;
    }

    return result;
  }

  private isMatchInProgress(): boolean {
    return this.match !== null && this.match.phase !== MatchPhase.FINISHED;
  }
}
