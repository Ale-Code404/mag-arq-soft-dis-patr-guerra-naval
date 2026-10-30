import { Match } from "../domain/match/Match";
import { Player } from "../domain/player/Player";
import { WeaponType } from "../domain/weapon/WeaponType";

type Side = "PLAYER" | "OPPONENT";
type Position = { row: number; column: number };

// A finished match as plain data: the configuration it was played with (D-10),
// the initial placement and every turn (RF-11, RF-13). CU-09 will read it back.
export type FinishedMatchRecord = {
  finishedAt: string;
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

export function toFinishedMatchRecord(match: Match, finishedAt: Date): FinishedMatchRecord {
  const side = (player: Player): Side => (player === match.human ? "PLAYER" : "OPPONENT");
  const position = ({ row, column }: Position): Position => ({ row, column });
  const { config } = match;

  return {
    finishedAt: finishedAt.toISOString(),
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
