import { Ship } from "../fleet/Ship";
import { Coordinate } from "../shared/Coordinate";

export class Cell {
  position: Coordinate;
  attacked: boolean = false;
  ship: Ship | null = null;

  constructor(position: Coordinate) {
    this.position = position;
  }

  // D-12: the attack reaches the cell first, and the cell tells its ship.
  receiveAttack(): boolean {
    this.attacked = true;

    if (this.ship === null) return false;

    this.ship.hit();
    return true;
  }
}
