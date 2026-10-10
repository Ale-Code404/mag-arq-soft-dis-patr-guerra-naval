import { Cell } from "./Cell";

export class Board {
  size: number;
  cells: Cell[];

  constructor(size: number, cells: Cell[]) {
    this.size = size;
    this.cells = cells;
  }
}
