import { Board } from "../board/Board";
import { Cell } from "../board/Cell";
import { Coordinate } from "../shared/Coordinate";
import { Weapon } from "./Weapon";
import { WeaponType } from "./WeaponType";

// D-18: runs along the target row from left to right and hits only the first
// ship cell not yet hit. The cells it crosses reveal nothing.
export class Torpedo extends Weapon {
  constructor(ammo: number) {
    super(WeaponType.TORPEDO, ammo);
  }

  protected area(board: Board, target: Coordinate): Cell[] | null {
    return board.contains(target) ? board.row(target.row) : null;
  }

  protected struck(area: Cell[]): Cell[] {
    const first = area.find((cell) => cell.ship !== null && !cell.attacked);
    return first === undefined ? [] : [first];
  }
}
