import { Board } from "../domain/board/Board";
import { Orientation } from "../domain/fleet/Orientation";
import { Ship } from "../domain/fleet/Ship";
import { Match } from "../domain/match/Match";
import { Player } from "../domain/player/Player";
import { PlayerAccount } from "./PlayerRepository";
import { Replay, ReplayTurn } from "../domain/replay/Replay";
import { Coordinate } from "../domain/shared/Coordinate";
import { CellOutcome } from "../domain/weapon/CellOutcome";
import { OutcomeType } from "../domain/weapon/OutcomeType";
import { WeaponType } from "../domain/weapon/WeaponType";

type Side = "PLAYER" | "OPPONENT";
type Position = { row: number; column: number };

// A finished match as plain data: the configuration it was played with (D-10),
// the initial placement and every turn (RF-11, RF-13). CU-09 reads it back.
export type FinishedMatchRecord = {
  finishedAt: string;
  // Who played it; null for matches saved before there were players.
  player: PlayerAccount | null;
  winner: Side;
  config: {
    boardSize: number;
    shipLengths: number[];
    difficulty: string;
    firstTurn: string;
    extraTurnOnHit: boolean;
    enabledWeapons: { type: WeaponType; ammo: number }[];
  };
  initialPlacement: { side: Side; length: number; origin: Position; orientation: string }[];
  turns: {
    number: number;
    side: Side;
    weapon: WeaponType;
    target: Position;
    outcomes: { position: Position; result: string }[];
    startedAt: string;
    endedAt: string;
  }[];
};

export function toFinishedMatchRecord(
  match: Match,
  finishedAt: Date,
  player: PlayerAccount | null = null,
): FinishedMatchRecord {
  const side = (player: Player): Side => (player === match.human ? "PLAYER" : "OPPONENT");
  const position = ({ row, column }: Position): Position => ({ row, column });
  const { config } = match;

  return {
    finishedAt: finishedAt.toISOString(),
    player: player === null ? null : { id: player.id, name: player.name },
    winner: side(match.winner!),
    config: {
      boardSize: config.boardSize,
      shipLengths: config.shipLengths,
      difficulty: config.difficulty,
      firstTurn: config.firstTurn,
      extraTurnOnHit: config.extraTurnOnHit,
      enabledWeapons: config.enabledWeapons.map(([type, ammo]) => ({ type, ammo })),
    },
    initialPlacement: match.initialPlacement.map((placement) => ({
      side: side(placement.player),
      length: placement.length,
      origin: position(placement.origin),
      orientation: placement.orientation,
    })),
    turns: match.turns.map((turn) => ({
      number: turn.number,
      side: side(turn.player),
      weapon: turn.weapon.type,
      target: position(turn.target),
      outcomes: turn.outcomes.map((outcome) => ({
        position: position(outcome.position),
        result: outcome.result,
      })),
      startedAt: turn.startedAt.toISOString(),
      endedAt: turn.endedAt.toISOString(),
    })),
  };
}

// CU-09, step 3: a saved match is valid when its replay can be rebuilt under
// the rules it was played with. Each fleet must match the configured lengths
// and be placed as RF-19 demands (inside, without overlap, apart); every
// outcome must fall inside the board and agree with the ships (a HIT on a
// ship, a MISS on water); and the winner must have sunk the rival fleet. The
// first broken rule makes the match invalid (3a), so null is returned.
export function toReplay(data: unknown): Replay | null {
  if (!isRecordShape(data)) return null;

  const { config } = data;
  if (!Number.isInteger(config.boardSize) || config.boardSize <= 0) return null;

  const boards: Record<Side, Board> = { PLAYER: Board.empty(config.boardSize), OPPONENT: Board.empty(config.boardSize) };

  for (const side of SIDES) {
    const placements = data.initialPlacement.filter((placement) => placement.side === side);
    const lengths = placements.map((placement) => placement.length);
    if (!lengths.every(Number.isInteger) || lengths.join() !== config.shipLengths.join()) return null;

    for (const placement of placements) {
      if (!isOrientation(placement.orientation) || !isPosition(placement.origin)) return null;

      const origin = new Coordinate(placement.origin.row, placement.origin.column);
      if (boards[side].place(new Ship(placement.length), origin, placement.orientation) !== null) return null;
    }
  }

  const turns: ReplayTurn[] = [];

  for (const turn of data.turns) {
    if (!Number.isInteger(turn.number) || !isSide(turn.side) || !isWeapon(turn.weapon) || !isPosition(turn.target)) {
      return null;
    }

    const rival = boards[turn.side === "PLAYER" ? "OPPONENT" : "PLAYER"];
    const outcomes: CellOutcome[] = [];

    for (const outcome of turn.outcomes) {
      if (!isPosition(outcome.position) || !isOutcome(outcome.result)) return null;

      const position = new Coordinate(outcome.position.row, outcome.position.column);
      const cell = rival.cellAt(position);
      if (cell === null) return null;

      const onShip = cell.ship !== null;
      if ((outcome.result === OutcomeType.HIT && !onShip) || (outcome.result === OutcomeType.MISS && onShip)) {
        return null;
      }

      outcomes.push(new CellOutcome(position, outcome.result));
    }

    turns.push({
      number: turn.number,
      side: turn.side,
      weapon: turn.weapon,
      target: new Coordinate(turn.target.row, turn.target.column),
      outcomes,
    });
  }

  const replay = new Replay(boards, turns, data.winner);
  const end = replay.at(turns.length)!;
  const loser = data.winner === "PLAYER" ? "OPPONENT" : "PLAYER";

  return end.boards[loser].ships().every((ship) => ship.isSunk()) ? replay : null;
}

const SIDES: Side[] = ["PLAYER", "OPPONENT"];

const isSide = (value: unknown): value is Side => value === "PLAYER" || value === "OPPONENT";
const isOrientation = (value: unknown): value is Orientation =>
  Object.values(Orientation).includes(value as Orientation);
const isWeapon = (value: unknown): value is WeaponType => Object.values(WeaponType).includes(value as WeaponType);
const isOutcome = (value: unknown): value is OutcomeType => Object.values(OutcomeType).includes(value as OutcomeType);
const isPosition = (value: unknown): value is Position =>
  typeof value === "object" &&
  value !== null &&
  Number.isInteger((value as Position).row) &&
  Number.isInteger((value as Position).column);

// Only the structure; the rules are checked while rebuilding the replay.
function isRecordShape(data: unknown): data is FinishedMatchRecord {
  const record = data as FinishedMatchRecord;
  return (
    typeof record === "object" &&
    record !== null &&
    typeof record.finishedAt === "string" &&
    isSide(record.winner) &&
    typeof record.config === "object" &&
    record.config !== null &&
    Array.isArray(record.config.shipLengths) &&
    record.config.shipLengths.every((length) => Number.isInteger(length) && length > 0) &&
    Array.isArray(record.initialPlacement) &&
    record.initialPlacement.every((placement) => typeof placement === "object" && placement !== null) &&
    Array.isArray(record.turns) &&
    record.turns.every((turn) => typeof turn === "object" && turn !== null && Array.isArray(turn.outcomes))
  );
}
