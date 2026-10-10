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
}
