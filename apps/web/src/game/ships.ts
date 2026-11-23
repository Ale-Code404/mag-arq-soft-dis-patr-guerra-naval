import type { BoardView, CellState, Orientation } from "../api/client";

export type ShipShape = {
  row: number;
  column: number;
  length: number;
  orientation: Orientation;
  sunk: boolean;
};

const PART_OF_SHIP: CellState[] = ["SHIP", "HIT", "SUNK"];

// Ships never touch (CU-03, 3c), so each group of adjacent ship cells is one
// ship. On a revealed board every ship is drawn; on the rival board only the
// sunk ones, the only ships whose whole shape is known.
export function shipsFromBoard(board: BoardView, revealed: boolean): ShipShape[] {
  const counts = revealed ? PART_OF_SHIP : (["SUNK"] as CellState[]);
  const seen = new Set<number>();
  const ships: ShipShape[] = [];

  for (let row = 0; row < board.size; row++) {
    for (let column = 0; column < board.size; column++) {
      const start = row * board.size + column;
      if (seen.has(start) || !counts.includes(board.cells[row][column])) continue;

      const cells: [number, number][] = [];
      const queue: [number, number][] = [[row, column]];
      seen.add(start);
      while (queue.length > 0) {
        const [r, c] = queue.pop()!;
        cells.push([r, c]);
        for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nr = r + dr;
          const nc = c + dc;
          const key = nr * board.size + nc;
          if (nr < 0 || nc < 0 || nr >= board.size || nc >= board.size || seen.has(key)) continue;
          if (!counts.includes(board.cells[nr][nc])) continue;
          seen.add(key);
          queue.push([nr, nc]);
        }
      }

      const rows = cells.map(([r]) => r);
      const columns = cells.map(([, c]) => c);
      const vertical = Math.max(...rows) > Math.min(...rows);
      ships.push({
        row: Math.min(...rows),
        column: Math.min(...columns),
        length: cells.length,
        orientation: vertical ? "VERTICAL" : "HORIZONTAL",
        sunk: cells.every(([r, c]) => board.cells[r][c] === "SUNK"),
      });
    }
  }

  return ships;
}
