import { Board } from "../board/Board";
import { Cell } from "../board/Cell";
import { Coordinate } from "../shared/Coordinate";
import { Weapon } from "./Weapon";
import { WeaponType } from "./WeaponType";

// Missile 1 x 1, bomb 2 x 2 and attack plane 1 x 3 only differ in size (D-16).
export class AreaWeapon extends Weapon {
  rows: number;
  columns: number;

  constructor(type: WeaponType, ammo: number, rows: number, columns: number) {
    super(type, ammo);

    this.rows = rows;
    this.columns = columns;
  }

  // The target is the top-left corner of the area.
  protected area(board: Board, target: Coordinate): Cell[] | null {
    return board.area(target, this.rows, this.columns);
  }

  // Cells already attacked are skipped (D-19).
  protected struck(area: Cell[]): Cell[] {
    return area.filter((cell) => !cell.attacked);
  }
}
