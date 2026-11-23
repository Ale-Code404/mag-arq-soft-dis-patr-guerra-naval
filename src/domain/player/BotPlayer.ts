import { Board } from "../board/Board";
import { Fleet } from "../fleet/Fleet";
import { Orientation } from "../fleet/Orientation";
import { Coordinate } from "../shared/Coordinate";
import { pick, Random } from "../shared/Random";
import { CellOutcome } from "../weapon/CellOutcome";
import { OutcomeType } from "../weapon/OutcomeType";
import { Weapon } from "../weapon/Weapon";
import { WeaponType } from "../weapon/WeaponType";
import { Player } from "./Player";
import { ShotRequest } from "./Shot";

// CU-11, 3a1: attempts per ship, and of the whole fleet, before giving up on
// the random placement. With the margin between ships (CU-03, 3c) an unlucky
// early ship can leave no room for a later one, so the fleet starts over.
const PLACEMENT_ATTEMPTS = 1000;
const FLEET_ATTEMPTS = 20;

const DIRECTIONS: [row: number, column: number][] = [[-1, 0], [1, 0], [0, -1], [0, 1]];

export class BotPlayer extends Player {
  hitProbability: number;
  rivalBoard: Board;
  private random: Random;
  // Cells where the bot hit a ship still afloat: it hunts around them.
  private hits: Coordinate[] = [];

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
    for (let attempt = 0; attempt < FLEET_ATTEMPTS; attempt++) {
      if (this.fleet.ships.every((_, index) => this.placeAtRandom(index))) return true;
      this.fleet.ships.forEach((_, i) => this.removeShip(i));
    }

    return false;
  }

  // CU-12, step 5: the bot remembers its hits to hunt the ship next turn.
  protected learn(outcomes: CellOutcome[]): void {
    for (const outcome of outcomes) {
      if (outcome.result === OutcomeType.HIT) this.hits.push(outcome.position);
    }
  }

  // While a hit ship is afloat, the bot hunts it with the missile, in every
  // difficulty and without the level's probability. Otherwise D-20: a random
  // damaging weapon with ammo; the level's probability decides whether the use
  // hits, and the target is drawn among those with that result.
  protected chooseShot(rivalBoard: Board): ShotRequest | null {
    const hunted = this.huntTarget(rivalBoard);
    if (hunted !== null) return { weapon: WeaponType.MISSILE, target: hunted };

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

  // An unattacked neighbour of a pending hit. Once two hits line up, the cells
  // that extend that line go first, as the ship lies along it.
  private huntTarget(board: Board): Coordinate | null {
    this.hits = this.hits.filter((hit) => board.cellAt(hit)?.ship?.isSunk() === false);
    if (this.hits.length === 0 || this.weapon(WeaponType.MISSILE) === null) return null;

    const isHit = (row: number, column: number) => this.hits.some((hit) => hit.row === row && hit.column === column);
    const isOpen = (row: number, column: number) => board.cellAt(new Coordinate(row, column))?.attacked === false;

    const alongLine: Coordinate[] = [];
    const around: Coordinate[] = [];
    for (const hit of this.hits) {
      for (const [dr, dc] of DIRECTIONS) {
        const row = hit.row + dr;
        const column = hit.column + dc;
        if (!isOpen(row, column)) continue;
        (isHit(hit.row - dr, hit.column - dc) ? alongLine : around).push(new Coordinate(row, column));
      }
    }

    const candidates = alongLine.length > 0 ? alongLine : around;
    return candidates.length > 0 ? pick(candidates, this.random) : null;
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
