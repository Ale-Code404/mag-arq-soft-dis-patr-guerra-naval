import { WeaponType } from "../domain/weapon/WeaponType";
import { MatchConfigRejection } from "../domain/match/MatchConfigRejection";
import { Difficulty } from "../domain/match/Difficulty";
import { FirstTurn } from "../domain/match/FirstTurn";
import { Match } from "../domain/match/Match";
import { MatchConfig, MatchConfigResult } from "../domain/match/MatchConfig";
import { MatchConfigBuilder } from "../domain/match/MatchConfigBuilder";
import { MatchFactory } from "../domain/match/MatchFactory";
import { MatchPhase } from "../domain/match/MatchPhase";
import { MatchView, toMatchView } from "./MatchView";

export type ConfigureMatchInput = {
  boardSize?: number;
  shipLengths?: number[];
  difficulty?: Difficulty;
  firstTurn?: FirstTurn;
  extraTurnOnHit?: boolean;
  enabledWeapons?: [weapon: WeaponType, ammo: number][];
};

export type StartMatchResult =
  | { started: true; match: MatchView }
  | { started: false; reason: "MATCH_IN_PROGRESS" };

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

  // CU-01, steps 3-4: create the match with the current configuration.
  // Placement (CU-03, CU-11) and the first turn come next.
  startMatch(): StartMatchResult {
    if (this.isMatchInProgress()) {
      return { started: false, reason: "MATCH_IN_PROGRESS" };
    }

    this.match = MatchFactory.create(this.config);

    return { started: true, match: toMatchView(this.match) };
  }

  // The match as the presentation may see it, or null before CU-01.
  currentMatch(): MatchView | null {
    return this.match === null ? null : toMatchView(this.match);
  }

  private isMatchInProgress(): boolean {
    return this.match !== null && this.match.phase !== MatchPhase.FINISHED;
  }
}
