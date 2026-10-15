import { Player } from "../player/Player";
import { Coordinate } from "../shared/Coordinate";
import { Weapon } from "../weapon/Weapon";
import { CellOutcome } from "./CellOutcome";

export class Turn {
  number: number;
  player: Player;
  weapon: Weapon;
  target: Coordinate;
  outcomes: CellOutcome[];
  startedAt: Date;
  endedAt: Date;

  constructor(
    number: number,
    player: Player,
    weapon: Weapon,
    target: Coordinate,
    outcomes: CellOutcome[],
    startedAt: Date,
    endedAt: Date,
  ) {
    this.number = number;
    this.player = player;
    this.weapon = weapon;
    this.target = target;
    this.outcomes = outcomes;
    this.startedAt = startedAt;
    this.endedAt = endedAt;
  }
}
