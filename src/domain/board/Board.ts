import { Ship } from "../fleet/Ship";
import { Orientation } from "../fleet/Orientation";
import { Coordinate } from "../shared/Coordinate";
import { Prototype } from "../shared/Prototype";
import { Cell } from "./Cell";
import { PlacementRejection } from "./PlacementRejection";

export class Board implements Prototype<Board> {
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
  // falls outside the board. Weapons use it (D-19).
  area(origin: Coordinate, rows: number, columns: number): Cell[] | null {
    const cells: Cell[] = [];

    for (let row = 0; row < rows; row++) {
      for (let column = 0; column < columns; column++) {
        const cell = this.cellAt(
          new Coordinate(origin.row + row, origin.column + column),
        );
        if (cell === null) return null;
        cells.push(cell);
      }
    }

    return cells;
  }

  row(index: number): Cell[] {
    return this.cells.filter((cell) => cell.position.row === index);
  }

  // CU-03, steps 3-4: inside the board, without overlapping another ship and
  // keeping the margin around it free of other ships.
  place(
    ship: Ship,
    origin: Coordinate,
    orientation: Orientation,
  ): PlacementRejection | null {
    const cells = ship.area(origin, orientation).map((position) => this.cellAt(position));
    if (cells.includes(null)) return PlacementRejection.OUT_OF_BOARD;

    // The ship may be moved over its own cells.
    const holdsOther = (cell: Cell | null) => cell !== null && cell.ship !== null && cell.ship !== ship;

    if (cells.some(holdsOther)) return PlacementRejection.OVERLAP;
    if (ship.surroundings(origin, orientation).map((p) => this.cellAt(p)).some(holdsOther)) {
      return PlacementRejection.TOO_CLOSE;
    }

    this.remove(ship);
    cells.forEach((cell) => (cell!.ship = ship));
    ship.placeAt(origin, orientation);

    return null;
  }

  // Prototype (CU-10): a deep copy. Each ship is cloned once and every cell of
  // the copy points to the cloned ship, so the copy can be attacked freely.
  clone(): Board {
    const ships = new Map<Ship, Ship>();
    const shipOf = (ship: Ship) => ships.get(ship) ?? ships.set(ship, ship.clone()).get(ship)!;

    const cells = this.cells.map((cell) => {
      const copy = new Cell(cell.position);
      copy.attacked = cell.attacked;
      copy.ship = cell.ship === null ? null : shipOf(cell.ship);
      return copy;
    });

    return new Board(this.size, cells);
  }

  // The distinct ships on the board, in the order their first cell appears.
  ships(): Ship[] {
    return [...new Set(this.cells.flatMap((cell) => (cell.ship === null ? [] : [cell.ship])))];
  }

  // CU-03, 5a: the ship goes back to the pending ones.
  remove(ship: Ship): void {
    this.cells
      .filter((cell) => cell.ship === ship)
      .forEach((cell) => (cell.ship = null));
    ship.unplace();
  }
}
