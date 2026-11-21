import { Coordinate } from "../shared/Coordinate";
import { Orientation } from "./Orientation";

export class Ship {
  // Free cells kept around every ship, diagonals included, so no two ships
  // touch (CU-03, 3c).
  static readonly DEFAULT_MARGIN = 1;

  length: number;
  // A ship exists before it is placed (D-11), so it starts without position.
  orientation: Orientation | null = null;
  origin: Coordinate | null = null;
  hits: number = 0;

  constructor(length: number) {
    this.length = length;
  }

  placeAt(origin: Coordinate, orientation: Orientation): void {
    this.origin = origin;
    this.orientation = orientation;
  }

  // The cells the ship takes with that origin (its left or top end) and orientation.
  area(origin: Coordinate, orientation: Orientation): Coordinate[] {
    return Array.from({ length: this.length }, (_, i) =>
      orientation === Orientation.VERTICAL
        ? new Coordinate(origin.row + i, origin.column)
        : new Coordinate(origin.row, origin.column + i),
    );
  }

  // The area grown by margin cells on every side, where no other ship may be.
  // It may fall partly outside the board; the board ignores those cells.
  surroundings(
    origin: Coordinate,
    orientation: Orientation,
    margin: number = Ship.DEFAULT_MARGIN,
  ): Coordinate[] {
    const area = this.area(origin, orientation);
    const end = area[area.length - 1];
    const cells: Coordinate[] = [];

    for (let row = origin.row - margin; row <= end.row + margin; row++) {
      for (let column = origin.column - margin; column <= end.column + margin; column++) {
        cells.push(new Coordinate(row, column));
      }
    }

    return cells;
  }

  unplace(): void {
    this.origin = null;
    this.orientation = null;
  }

  hit(): void {
    this.hits++;
  }

  isPlaced(): boolean {
    return this.origin !== null;
  }

  isSunk(): boolean {
    return this.hits >= this.length;
  }
}
