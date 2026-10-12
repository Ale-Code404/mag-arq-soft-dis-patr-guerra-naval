import { Cell } from "./Cell";

export class Board {
  size: number;
  cells: Cell[];

  constructor(size: number) {
    this.size = size;
    this.cells = [];
  }

  area(): number {
    return this.size * this.size;
  }
}
