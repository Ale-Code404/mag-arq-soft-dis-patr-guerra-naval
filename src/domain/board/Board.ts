import { Coordinate } from "../shared/Coordinate";
import { Cell } from "./Cell";

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
}
