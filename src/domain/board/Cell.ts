import { Ship } from "../fleet/Ship";
import { Coordinate } from "../shared/Coordinate";

export class Cell {
  position: Coordinate;
  attacked: boolean = false;
  ship: Ship | null = null;

  constructor(position: Coordinate) {
    this.position = position;
  }
}
