import { Board } from "../domain/board/Board";
import { Cell } from "../domain/board/Cell";
import { Match } from "../domain/match/Match";
import { MatchPhase } from "../domain/match/MatchPhase";
import { Player } from "../domain/player/Player";
import { WeaponType } from "../domain/weapon/WeaponType";

// What a presentation may draw: plain data, without domain objects.
// RNF-03: each state gets its own symbol or color.
export enum CellState {
  // Not attacked and no visible ship: own water, or an unknown rival cell.
  EMPTY = "EMPTY",
  SHIP = "SHIP",
  MISS = "MISS",
  HIT = "HIT",
  SUNK = "SUNK",
}

export type BoardView = {
  size: number;
  // Row-major: cells[row][column].
  cells: CellState[][];
};

export type WeaponView = {
  type: WeaponType;
  // null means unlimited ammo (D-21); JSON has no Infinity.
  ammo: number | null;
};

export type ShipView = {
  length: number;
  placed: boolean;
  sunk: boolean;
};

export type MatchView = {
  phase: MatchPhase;
  ownBoard: BoardView;
  // CU-01, step 7: the rival fleet is never revealed, only the outcome of attacks.
  rivalBoard: BoardView;
  fleet: ShipView[];
  arsenal: WeaponView[];
};

export function toMatchView(match: Match): MatchView {
  const [human, bot] = match.players;

  return {
    phase: match.phase,
    ownBoard: toBoardView(human.board, true),
    rivalBoard: toBoardView(bot.board, false),
    fleet: human.fleet.ships.map((ship) => ({
      length: ship.length,
      placed: ship.isPlaced(),
      sunk: ship.isSunk(),
    })),
    arsenal: toArsenalView(human),
  };
}

function toBoardView(board: Board, revealShips: boolean): BoardView {
  const cells: CellState[][] = Array.from({ length: board.size }, () =>
    Array<CellState>(board.size).fill(CellState.EMPTY),
  );

  for (const cell of board.cells) {
    cells[cell.position.row][cell.position.column] = toCellState(cell, revealShips);
  }

  return { size: board.size, cells };
}

function toCellState(cell: Cell, revealShips: boolean): CellState {
  if (cell.attacked) {
    if (cell.ship === null) return CellState.MISS;
    return cell.ship.isSunk() ? CellState.SUNK : CellState.HIT;
  }

  return revealShips && cell.ship !== null ? CellState.SHIP : CellState.EMPTY;
}

function toArsenalView(player: Player): WeaponView[] {
  return player.weapons.map((weapon) => {
    const ammo = weapon.remainingAmmo();
    return { type: weapon.type, ammo: Number.isFinite(ammo) ? ammo : null };
  });
}
