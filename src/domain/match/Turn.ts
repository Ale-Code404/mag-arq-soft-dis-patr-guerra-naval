import { Player } from "../player/Player";
import { Coordinate } from "../shared/Coordinate";
import { CellOutcome } from "../weapon/CellOutcome";
import { OutcomeType } from "../weapon/OutcomeType";
import { Weapon } from "../weapon/Weapon";

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

  // RF-23: a hit is a use that hits at least one ship cell. Recon never hits.
  isHit(): boolean {
    return this.outcomes.some((outcome) => outcome.result === OutcomeType.HIT);
  }
}
