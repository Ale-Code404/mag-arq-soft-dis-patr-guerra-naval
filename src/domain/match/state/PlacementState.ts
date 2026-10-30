import { Orientation } from "../../fleet/Orientation";
import { Coordinate } from "../../shared/Coordinate";
import type { Match } from "../Match";
import { MatchPhase } from "../MatchPhase";
import { MatchRejection, MatchResult } from "../MatchRejection";
import { Turn } from "../Turn";
import { InProgressState } from "./InProgressState";
import { MatchState } from "./MatchState";

// CU-03: the Jugador places, moves or removes ships until confirming.
export class PlacementState extends MatchState {
  readonly phase = MatchPhase.PLACEMENT;

  placeShip(match: Match, index: number, origin: Coordinate, orientation: Orientation): MatchResult {
    if (match.human.fleet.ship(index) === null) {
      return { ok: false, rejection: MatchRejection.UNKNOWN_SHIP };
    }

    if (!Object.values(Orientation).includes(orientation)) {
      return { ok: false, rejection: MatchRejection.UNKNOWN_ORIENTATION };
    }

    const rejection = match.human.placeShip(index, origin, orientation);
    return rejection === null ? { ok: true } : { ok: false, rejection };
  }

  removeShip(match: Match, index: number): MatchResult {
    if (match.human.fleet.ship(index) === null) {
      return { ok: false, rejection: MatchRejection.UNKNOWN_SHIP };
    }

    match.human.removeShip(index);
    return { ok: true };
  }

  // CU-03, steps 5-7, then CU-01, steps 6-7.
  confirmPlacement(match: Match): MatchResult<{ turns: Turn[] }> {
    if (!match.human.fleet.isPlaced()) {
      return { ok: false, rejection: MatchRejection.FLEET_NOT_PLACED };
    }

    if (!match.bot.placeFleet()) {
      return { ok: false, rejection: MatchRejection.OPPONENT_PLACEMENT_FAILED };
    }

    match.saveInitialSnapshot();
    match.changeState(new InProgressState());

    // CU-01, 7a and 7b: the opponent may open the match.
    const turns = match.drawOpponentFirst() ? match.playOpponentTurns() : [];
    return { ok: true, turns };
  }
}
