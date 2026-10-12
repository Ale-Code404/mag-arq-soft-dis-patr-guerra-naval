import { ConfigRejection } from "./ConfigRejection";
import { Difficulty } from "./Difficulty";
import { FirstTurn } from "./FirstTurn";
import { MatchConfig } from "./MatchConfig";

export type MatchConfigResult =
  | { accepted: true; config: MatchConfig }
  | { accepted: false; rejection: ConfigRejection };

// Builder: the configuration is changed step by step (CU-02, steps 3-8) and
// validated once, when it is built (step 9). The product is immutable (D-10).
export class MatchConfigBuilder {
  private boardSize: number;
  private shipLengths: number[];
  private difficulty: Difficulty;
  private firstTurn: FirstTurn;
  private extraTurnOnHit: boolean;
  private enabledWeapons: [weapon: string, ammo: number][];

  private constructor(base: MatchConfig) {
    this.boardSize = base.boardSize;
    this.shipLengths = base.shipLengths;
    this.difficulty = base.difficulty;
    this.firstTurn = base.firstTurn;
    this.extraTurnOnHit = base.extraTurnOnHit;
    this.enabledWeapons = base.enabledWeapons;
  }

  // Every value starts as the base one, so a step the player skips keeps it (CU-02, 3a).
  static from(base: MatchConfig): MatchConfigBuilder {
    return new MatchConfigBuilder(base);
  }

  withBoardSize(boardSize: number): MatchConfigBuilder {
    this.boardSize = boardSize;
    return this;
  }

  withShipLengths(shipLengths: number[]): MatchConfigBuilder {
    this.shipLengths = shipLengths;
    return this;
  }

  withDifficulty(difficulty: Difficulty): MatchConfigBuilder {
    this.difficulty = difficulty;
    return this;
  }

  withFirstTurn(firstTurn: FirstTurn): MatchConfigBuilder {
    this.firstTurn = firstTurn;
    return this;
  }

  withExtraTurnOnHit(extraTurnOnHit: boolean): MatchConfigBuilder {
    this.extraTurnOnHit = extraTurnOnHit;
    return this;
  }

  withEnabledWeapons(enabledWeapons: [weapon: string, ammo: number][]): MatchConfigBuilder {
    this.enabledWeapons = enabledWeapons;
    return this;
  }

  // Step 9 (9a, 9b). The rules stay in MatchConfig, which owns the data.
  build(): MatchConfigResult {
    const candidate = new MatchConfig(
      this.boardSize,
      this.shipLengths,
      this.difficulty,
      this.firstTurn,
      this.extraTurnOnHit,
      this.enabledWeapons,
    );

    if (!candidate.isBoardSizeAllowed()) {
      return { accepted: false, rejection: ConfigRejection.BOARD_SIZE_OUT_OF_LIMITS };
    }

    if (!candidate.fleetFitsBoard()) {
      return { accepted: false, rejection: ConfigRejection.FLEET_DOES_NOT_FIT };
    }

    return { accepted: true, config: candidate };
  }
}
