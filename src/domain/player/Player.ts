import { Board } from "../board/Board";
import { Fleet } from "../fleet/Fleet";
import { Weapon } from "../weapon/Weapon";

export abstract class Player {
  name: string;
  board: Board;
  fleet: Fleet;
  weapons: Weapon[];

  constructor(name: string, board: Board, fleet: Fleet, weapons: Weapon[]) {
    this.name = name;
    this.board = board;
    this.fleet = fleet;
    this.weapons = weapons;
  }
}
