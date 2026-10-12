import { MatchConfigRejection } from "./MatchConfigRejection";
import { Difficulty } from "./Difficulty";
import { FirstTurn } from "./FirstTurn";

interface MathConfigInput {
  boardSize: number;
  shipLengths: number[];
  difficulty: Difficulty;
  firstTurn: FirstTurn;
  extraTurnOnHit: boolean;
  enabledWeapons: [weapon: string, ammo: number][];
}

export type MatchConfigResult =
  | { accepted: true; config: MatchConfig }
  | { accepted: false; rejection: MatchConfigRejection };

export class MatchConfig {
  readonly boardSize: number;
  readonly shipLengths: number[];
  readonly difficulty: Difficulty;
  readonly firstTurn: FirstTurn;
  readonly extraTurnOnHit: boolean;
  readonly enabledWeapons: [weapon: string, ammo: number][];

  private constructor({
    boardSize,
    shipLengths,
    difficulty,
    firstTurn,
    extraTurnOnHit,
    enabledWeapons,
  }: MathConfigInput) {
    this.boardSize = boardSize;
    this.shipLengths = shipLengths;
    this.difficulty = difficulty;
    this.firstTurn = firstTurn;
    this.extraTurnOnHit = extraTurnOnHit;
    this.enabledWeapons = enabledWeapons;
  }

  static defaults(): MatchConfig {
    return new MatchConfig({
      boardSize: 8,
      shipLengths: [5, 4, 3, 3, 2],
      difficulty: Difficulty.NORMAL,
      firstTurn: FirstTurn.RANDOM,
      extraTurnOnHit: false,
      enabledWeapons: [
        ["bomb", 2],
        ["bomber", 2],
        ["recon_plane", 2],
        ["torpedo", 1],
      ],
    });
  }

  static create(input: MathConfigInput): MatchConfigResult {
    const candidate = new MatchConfig(input);

    if (!candidate.isBoardSizeAllowed()) {
      return {
        accepted: false,
        rejection: MatchConfigRejection.BOARD_SIZE_OUT_OF_LIMITS,
      };
    }

    if (!candidate.isFleetAllowed()) {
      return {
        accepted: false,
        rejection: MatchConfigRejection.FLEET_SIZE_OUT_OF_LIMITS,
      };
    }

    if (!candidate.isFleetFitsBoard()) {
      return {
        accepted: false,
        rejection: MatchConfigRejection.FLEET_DOES_NOT_FIT,
      };
    }

    return { accepted: true, config: candidate };
  }

  isBoardSizeAllowed(): boolean {
    return this.boardSize >= 8 && this.boardSize <= 24;
  }

  isFleetAllowed(): boolean {
    const hasMinimumFleetSize = this.shipLengths.length >= 5;
    const areAllLengthsPositive = this.shipLengths.every(
      (length) => length > 0,
    );

    return hasMinimumFleetSize && areAllLengthsPositive;
  }

  isFleetFitsBoard(): boolean {
    const boardArea = this.boardSize * this.boardSize;
    const fleetArea = this.shipLengths.reduce((acc, length) => acc + length, 0);

    return boardArea - fleetArea >= boardArea * 0.3;
  }
}
