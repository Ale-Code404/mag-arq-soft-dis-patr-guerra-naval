import { Board } from "../domain/board/Board";
import { Cell } from "../domain/board/Cell";
import { Match } from "../domain/match/Match";
import { MatchPhase } from "../domain/match/MatchPhase";
import { Turn } from "../domain/match/Turn";
import { Orientation } from "../domain/fleet/Orientation";
import { Player } from "../domain/player/Player";
import { OutcomeType } from "../domain/weapon/OutcomeType";
import { WeaponType } from "../domain/weapon/WeaponType";

// What a presentation may draw: plain data, without domain objects (D-26).
// RNF-03: each state gets its own symbol or color.
export enum CellState {
  // Not attacked and no visible ship: own water, or an unknown rival cell.
  EMPTY = "EMPTY",
  SHIP = "SHIP",
  MISS = "MISS",
  HIT = "HIT",
  SUNK = "SUNK",
}

export type Side = "PLAYER" | "OPPONENT";

export type BoardView = {
  size: number;
  // Row-major: cells[row][column].
  cells: CellState[][];
};

export type WeaponView = {
  type: WeaponType;
  // null means unlimited ammo (D-21); JSON has no Infinity.
  ammo: number | null;
  damaging: boolean;
};

export type ShipView = {
  length: number;
  placed: boolean;
  sunk: boolean;
  origin: { row: number; column: number } | null;
  orientation: Orientation | null;
};

export type TurnView = {
  number: number;
  side: Side;
  weapon: WeaponType;
  target: { row: number; column: number };
  // Recon outcomes (SPOTTED, CLEAR) are shown for 10 seconds by the client (D-17).
  outcomes: { row: number; column: number; result: OutcomeType }[];
};

export type MatchView = {
  phase: MatchPhase;
  ownBoard: BoardView;
  // CU-01, step 7: the rival fleet is never revealed, only the outcome of attacks.
  rivalBoard: BoardView;
  fleet: ShipView[];
  rivalShipsAfloat: number;
  arsenal: WeaponView[];
  // CU-06, steps 2 and 4.
  winner: Side | null;
  turnsPlayed: number;
};

export function toMatchView(match: Match): MatchView {
  const { human, bot } = match;

  return {
    phase: match.phase,
    ownBoard: toBoardView(human.board, true),
    rivalBoard: toBoardView(bot.board, false),
    fleet: human.fleet.ships.map((ship) => ({
      length: ship.length,
      placed: ship.isPlaced(),
      sunk: ship.isSunk(),
      origin: ship.origin === null ? null : { row: ship.origin.row, column: ship.origin.column },
      orientation: ship.orientation,
    })),
    rivalShipsAfloat: bot.fleet.ships.filter((ship) => !ship.isSunk()).length,
    arsenal: toArsenalView(human),
    winner: match.winner === null ? null : sideOf(match, match.winner),
    turnsPlayed: match.turns.length,
  };
}

export function toTurnViews(match: Match, turns: Turn[]): TurnView[] {
  return turns.map((turn) => ({
    number: turn.number,
    side: sideOf(match, turn.player),
    weapon: turn.weapon.type,
    target: { row: turn.target.row, column: turn.target.column },
    outcomes: turn.outcomes.map((outcome) => ({
      row: outcome.position.row,
      column: outcome.position.column,
      result: outcome.result,
    })),
  }));
}

function sideOf(match: Match, player: Player): Side {
  return player === match.human ? "PLAYER" : "OPPONENT";
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
    return {
      type: weapon.type,
      ammo: Number.isFinite(ammo) ? ammo : null,
      damaging: weapon.isDamaging(),
    };
  });
}
