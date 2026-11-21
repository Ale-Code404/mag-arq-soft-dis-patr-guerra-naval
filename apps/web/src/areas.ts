import type { BoardView, Position, WeaponType } from "./api/client";

// Area of each weapon from its target (top-left corner), as the domain defines it
// (D-16). The torpedo covers its whole row (D-18).
const AREA: Record<Exclude<WeaponType, "TORPEDO">, { rows: number; columns: number }> = {
  MISSILE: { rows: 1, columns: 1 },
  BOMB: { rows: 2, columns: 2 },
  BOMBER: { rows: 1, columns: 3 },
  RECON_PLANE: { rows: 3, columns: 3 },
};

// The cells covered inside the board, column by column, and whether the whole
// area fits (otherwise the API rejects it with AREA_OUT_OF_BOARD).
export function weaponArea(
  weapon: WeaponType,
  { row, column }: Position,
  boardSize: number,
): { cells: Position[]; fits: boolean } {
  if (weapon === "TORPEDO") {
    return { cells: Array.from({ length: boardSize }, (_, c) => ({ row, column: c })), fits: true };
  }

  const { rows, columns } = AREA[weapon];
  const cells: Position[] = [];
  for (let c = column; c < Math.min(column + columns, boardSize); c++) {
    for (let r = row; r < Math.min(row + rows, boardSize); r++) cells.push({ row: r, column: c });
  }
  return { cells, fits: row + rows <= boardSize && column + columns <= boardSize };
}

// D-19, as the API checks it: the area fits and has a cell not attacked yet.
export function canAttack(weapon: WeaponType, target: Position, board: BoardView): boolean {
  const { cells, fits } = weaponArea(weapon, target, board.size);
  return fits && cells.some(({ row, column }) => board.cells[row][column] === "EMPTY");
}
