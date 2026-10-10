import { Difficulty } from "./Difficulty";
import { FirstTurn } from "./FirstTurn";

export class MatchConfig {
  readonly boardSize: number;
  readonly shipLengths: number[];
  readonly difficulty: Difficulty;
  readonly firstTurn: FirstTurn;
  readonly extraTurnOnHit: boolean;
  readonly enabledWeapons: [weapon: string, ammo: number][];

  constructor(
    boardSize: number,
    shipLengths: number[],
    difficulty: Difficulty,
    firstTurn: FirstTurn,
    extraTurnOnHit: boolean,
    enabledWeapons: [weapon: string, ammo: number][],
  ) {
    this.boardSize = boardSize;
    this.shipLengths = shipLengths;
    this.difficulty = difficulty;
    this.firstTurn = firstTurn;
    this.extraTurnOnHit = extraTurnOnHit;
    this.enabledWeapons = enabledWeapons;
  }

  // CU-02, comments: the default configuration.
  static defaults(): MatchConfig {
    throw new Error("Not implemented: MatchConfig.defaults");
  }

  // CU-02, 9a: the board size is within the allowed limits.
  isBoardSizeAllowed(): boolean {
    throw new Error("Not implemented: MatchConfig.isBoardSizeAllowed");
  }

  // CU-02, 9b: no ship is longer than a side and the fleet fits the board.
  fleetFitsBoard(): boolean {
    throw new Error("Not implemented: MatchConfig.fleetFitsBoard");
  }
}
