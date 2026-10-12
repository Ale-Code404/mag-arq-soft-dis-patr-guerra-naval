import { Difficulty } from "./Difficulty";
import { FirstTurn } from "./FirstTurn";
import { MatchConfig, MatchConfigResult } from "./MatchConfig";

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

  withEnabledWeapons(
    enabledWeapons: [weapon: string, ammo: number][],
  ): MatchConfigBuilder {
    this.enabledWeapons = enabledWeapons;
    return this;
  }

  build(): MatchConfigResult {
    return MatchConfig.create({
      boardSize: this.boardSize,
      shipLengths: this.shipLengths,
      difficulty: this.difficulty,
      firstTurn: this.firstTurn,
      extraTurnOnHit: this.extraTurnOnHit,
      enabledWeapons: this.enabledWeapons,
    });
  }
}
