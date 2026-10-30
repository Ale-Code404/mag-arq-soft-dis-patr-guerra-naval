import { Board } from "../board/Board";
import { Cell } from "../board/Cell";
import { Coordinate } from "../shared/Coordinate";
import { CellOutcome } from "./CellOutcome";
import { OutcomeType } from "./OutcomeType";
import { Weapon } from "./Weapon";
import { WeaponType } from "./WeaponType";

// Shows which cells of a 3 x 3 area hold a ship without damaging them. The
// 10 seconds are applied by the presentation (D-17).
export class ReconPlane extends Weapon {
  revealSeconds: number;

  constructor(ammo: number, revealSeconds: number) {
    super(WeaponType.RECON_PLANE, ammo);

    this.revealSeconds = revealSeconds;
  }

  isDamaging(): boolean {
    return false;
  }

  protected area(board: Board, target: Coordinate): Cell[] | null {
    return board.area(target, 3, 3);
  }

  protected struck(): Cell[] {
    return [];
  }

  protected apply(area: Cell[]): CellOutcome[] {
    return area.map(
      (cell) =>
        new CellOutcome(cell.position, cell.ship !== null ? OutcomeType.SPOTTED : OutcomeType.CLEAR),
    );
  }
}
