import { Board } from "../board/Board";
import { Ship } from "../fleet/Ship";
import { Coordinate } from "../shared/Coordinate";
import { CellOutcome } from "../weapon/CellOutcome";
import { OutcomeType } from "../weapon/OutcomeType";
import { WeaponType } from "../weapon/WeaponType";

export type ReplaySide = "PLAYER" | "OPPONENT";

// A recorded turn: what was fired and what each cell answered (RF-11).
export type ReplayTurn = {
  number: number;
  side: ReplaySide;
  weapon: WeaponType;
  target: Coordinate;
  outcomes: CellOutcome[];
};

export type ReplayFrame = {
  // How many turns have been applied: 0 is the initial state.
  turn: number;
  boards: Record<ReplaySide, Board>;
  // The turn that led here, or null at the initial state.
  last: ReplayTurn | null;
  // The ships that turn sank.
  lastSunk: Ship[];
};

// CU-10: a finished match walked turn by turn. The initial boards are kept as
// prototypes; any turn k is rebuilt by cloning them and applying the recorded
// outcomes of the first k turns. The weapons are never run again, so the
// replay shows what happened even if a rule changes later.
export class Replay {
  private readonly initialBoards: Record<ReplaySide, Board>;
  readonly turns: ReplayTurn[];
  readonly winner: ReplaySide;

  constructor(initialBoards: Record<ReplaySide, Board>, turns: ReplayTurn[], winner: ReplaySide) {
    this.initialBoards = initialBoards;
    this.turns = turns;
    this.winner = winner;
  }

  // CU-10, steps 3 and 5, 4a1 and 4a2. Null outside 0..turns.length.
  at(turn: number): ReplayFrame | null {
    if (!Number.isInteger(turn) || turn < 0 || turn > this.turns.length) return null;

    const boards: Record<ReplaySide, Board> = {
      PLAYER: this.initialBoards.PLAYER.clone(),
      OPPONENT: this.initialBoards.OPPONENT.clone(),
    };

    let lastSunk: Ship[] = [];
    for (const [index, played] of this.turns.slice(0, turn).entries()) {
      const rival = boards[played.side === "PLAYER" ? "OPPONENT" : "PLAYER"];
      const afloat = index === turn - 1 ? rival.ships().filter((ship) => !ship.isSunk()) : [];
      for (const outcome of played.outcomes) {
        // Recon outcomes (SPOTTED, CLEAR) leave the cell as it was (D-17).
        if (outcome.result === OutcomeType.HIT || outcome.result === OutcomeType.MISS) {
          rival.cellAt(outcome.position)!.receiveAttack();
        }
      }
      lastSunk = afloat.filter((ship) => ship.isSunk());
    }

    return { turn, boards, last: turn === 0 ? null : this.turns[turn - 1], lastSunk };
  }
}
