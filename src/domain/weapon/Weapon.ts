import { Board } from "../board/Board";
import { Cell } from "../board/Cell";
import { Coordinate } from "../shared/Coordinate";
import { CellOutcome } from "./CellOutcome";
import { OutcomeType } from "./OutcomeType";
import { WeaponRejection } from "./WeaponRejection";
import { WeaponType } from "./WeaponType";

export type WeaponUse =
  | { used: true; outcomes: CellOutcome[] }
  | { used: false; rejection: WeaponRejection };

// Strategy: each weapon decides which cells it covers and what it does to them
// (RF-25, D-16 to D-18). The player picks one per turn and uses it the same way.
export abstract class Weapon {
  readonly type: WeaponType;
  private ammo: number;

  constructor(type: WeaponType, ammo: number) {
    this.type = type;
    this.ammo = ammo;
  }

  // CU-04, steps 2-3: validate, apply and spend one unit of ammo.
  use(board: Board, target: Coordinate): WeaponUse {
    const rejection = this.check(board, target);
    if (rejection !== null) return { used: false, rejection };

    const outcomes = this.apply(this.area(board, target)!);
    this.ammo--;

    return { used: true, outcomes };
  }

  // D-19: with ammo, the whole area inside the board and one cell not attacked.
  check(board: Board, target: Coordinate): WeaponRejection | null {
    if (this.ammo <= 0) return WeaponRejection.NO_AMMO;

    const area = this.area(board, target);
    if (area === null) return WeaponRejection.AREA_OUT_OF_BOARD;
    if (area.every((cell) => cell.attacked)) return WeaponRejection.AREA_ALREADY_ATTACKED;

    return null;
  }

  // D-20: whether a valid use would hit at least one ship cell. Only the bot
  // asks, because it knows the rival board (D-09).
  wouldHit(board: Board, target: Coordinate): boolean {
    const area = this.area(board, target);
    return area !== null && this.struck(area).some((cell) => cell.ship !== null);
  }

  isDamaging(): boolean {
    return true;
  }

  remainingAmmo(): number {
    return this.ammo;
  }

  // The cells the weapon covers from the target, or null if they leave the board.
  protected abstract area(board: Board, target: Coordinate): Cell[] | null;

  // The cells of the area that the weapon actually attacks.
  protected abstract struck(area: Cell[]): Cell[];

  protected apply(area: Cell[]): CellOutcome[] {
    return this.struck(area).map(
      (cell) =>
        new CellOutcome(cell.position, cell.receiveAttack() ? OutcomeType.HIT : OutcomeType.MISS),
    );
  }
}
