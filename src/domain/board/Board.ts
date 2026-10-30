import { Ship } from "../fleet/Ship";
import { Orientation } from "../fleet/Orientation";
import { Coordinate } from "../shared/Coordinate";
import { Cell } from "./Cell";
import { PlacementRejection } from "./PlacementRejection";

export class Board {
  size: number;
  cells: Cell[];

  constructor(size: number, cells: Cell[]) {
    this.size = size;
    this.cells = cells;
  }

  // Creator: the board contains its cells, so it creates them (CU-01, step 4).
  static empty(size: number): Board {
    const cells: Cell[] = [];

    for (let row = 0; row < size; row++) {
      for (let column = 0; column < size; column++) {
        cells.push(new Cell(new Coordinate(row, column)));
      }
    }

    return new Board(size, cells);
  }

  contains(position: Coordinate): boolean {
    return (
      Number.isInteger(position.row) &&
      Number.isInteger(position.column) &&
      position.row >= 0 &&
      position.row < this.size &&
      position.column >= 0 &&
      position.column < this.size
    );
  }

  cellAt(position: Coordinate): Cell | null {
    if (!this.contains(position)) return null;
    return this.cells[position.row * this.size + position.column];
  }

  // The rectangle with its top-left corner at origin, or null if any cell
  // falls outside the board. Ships and weapons share it (D-19).
  area(origin: Coordinate, rows: number, columns: number): Cell[] | null {
    const cells: Cell[] = [];

    for (let row = 0; row < rows; row++) {
      for (let column = 0; column < columns; column++) {
        const cell = this.cellAt(new Coordinate(origin.row + row, origin.column + column));
        if (cell === null) return null;
        cells.push(cell);
      }
    }

    return cells;
  }

  row(index: number): Cell[] {
    return this.cells.filter((cell) => cell.position.row === index);
  }

  // CU-03, steps 3-4: inside the board and without overlapping another ship.
  place(ship: Ship, origin: Coordinate, orientation: Orientation): PlacementRejection | null {
    const horizontal = orientation === Orientation.HORIZONTAL;
    const cells = this.area(origin, horizontal ? 1 : ship.length, horizontal ? ship.length : 1);

    if (cells === null) return PlacementRejection.OUT_OF_BOARD;
    if (cells.some((cell) => cell.ship !== null && cell.ship !== ship)) {
      return PlacementRejection.OVERLAP;
    }

    this.remove(ship);
    cells.forEach((cell) => (cell.ship = ship));
    ship.placeAt(origin, orientation);

    return null;
  }

  // CU-03, 5a: the ship goes back to the pending ones.
  remove(ship: Ship): void {
    this.cells.filter((cell) => cell.ship === ship).forEach((cell) => (cell.ship = null));
    ship.unplace();
  }
}
