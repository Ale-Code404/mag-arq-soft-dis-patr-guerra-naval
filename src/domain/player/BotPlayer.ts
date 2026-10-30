import { Board } from "../board/Board";
import { Fleet } from "../fleet/Fleet";
import { Orientation } from "../fleet/Orientation";
import { Coordinate } from "../shared/Coordinate";
import { pick, Random } from "../shared/Random";
import { Weapon } from "../weapon/Weapon";
import { Player } from "./Player";
import { ShotRequest } from "./Shot";

// CU-11, 3a1: attempts per ship before giving up on the random placement.
const PLACEMENT_ATTEMPTS = 1000;

export class BotPlayer extends Player {
  hitProbability: number;
  rivalBoard: Board;
  private random: Random;

  constructor(
    name: string,
    board: Board,
    fleet: Fleet,
    weapons: Weapon[],
    hitProbability: number,
    rivalBoard: Board,
    random: Random,
  ) {
    super(name, board, fleet, weapons);

    this.hitProbability = hitProbability;
    this.rivalBoard = rivalBoard;
    this.random = random;
  }

  // CU-11: a random origin and orientation per ship, validated with the same
  // rules as the Jugador. If a ship never fits, the fleet is left unplaced.
  placeFleet(): boolean {
    for (let index = 0; index < this.fleet.ships.length; index++) {
      if (!this.placeAtRandom(index)) {
        this.fleet.ships.forEach((_, i) => this.removeShip(i));
        return false;
      }
    }

    return true;
  }

  // D-20: a random damaging weapon with ammo; the level's probability decides
  // whether the use hits, and the target is drawn among those with that result.
  protected chooseShot(rivalBoard: Board): ShotRequest | null {
    const wantsHit = this.random() < this.hitProbability;
    const usable = this.weapons
      .filter((weapon) => weapon.isDamaging())
      .map((weapon) => ({ weapon, targets: this.validTargets(weapon, rivalBoard) }))
      .filter(({ targets }) => targets.length > 0);

    if (usable.length === 0) return null;

    const { weapon, targets } = pick(usable, this.random);
    const matching = targets.filter((target) => weapon.wouldHit(rivalBoard, target) === wantsHit);

    return { weapon: weapon.type, target: pick(matching.length > 0 ? matching : targets, this.random) };
  }

  private validTargets(weapon: Weapon, board: Board): Coordinate[] {
    return board.cells
      .map((cell) => cell.position)
      .filter((target) => weapon.check(board, target) === null);
  }

  private placeAtRandom(index: number): boolean {
    for (let attempt = 0; attempt < PLACEMENT_ATTEMPTS; attempt++) {
      const origin = new Coordinate(
        Math.floor(this.random() * this.board.size),
        Math.floor(this.random() * this.board.size),
      );
      const orientation = this.random() < 0.5 ? Orientation.HORIZONTAL : Orientation.VERTICAL;

      if (this.placeShip(index, origin, orientation) === null) return true;
    }

    return false;
  }
}
