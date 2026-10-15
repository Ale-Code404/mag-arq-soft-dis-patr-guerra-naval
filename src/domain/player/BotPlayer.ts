import { Board } from "../board/Board";
import { Fleet } from "../fleet/Fleet";
import { Weapon } from "../weapon/Weapon";
import { Player } from "./Player";

export class BotPlayer extends Player {
  hitProbability: number;
  rivalBoard: Board;

  constructor(
    name: string,
    board: Board,
    fleet: Fleet,
    weapons: Weapon[],
    hitProbability: number,
    rivalBoard: Board,
  ) {
    super(name, board, fleet, weapons);

    this.hitProbability = hitProbability;
    this.rivalBoard = rivalBoard;
  }
}
