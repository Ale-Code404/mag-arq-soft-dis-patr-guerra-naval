import { ShotRequest } from "../../player/Shot";
import type { Match } from "../Match";
import { MatchPhase } from "../MatchPhase";
import { MatchResult } from "../MatchRejection";
import { Turn } from "../Turn";
import { MatchState } from "./MatchState";

// CU-04: only firing is allowed, and every shot is the Jugador's.
export class InProgressState extends MatchState {
  readonly phase = MatchPhase.IN_PROGRESS;

  fire(match: Match, request: ShotRequest): MatchResult<{ turns: Turn[] }> {
    const played = match.playTurn(match.human, match.bot, request);
    if (!played.ok) return played;

    const turns = [played.turn];

    // CU-04, 3a1: the opponent fleet is sunk and CU-06 ends the match.
    if (match.bot.fleet.isSunk()) {
      match.finish(match.human);
      return { ok: true, turns };
    }

    // CU-04, 3b: a hit keeps the turn when the configuration says so.
    if (match.config.extraTurnOnHit && played.turn.isHit()) {
      return { ok: true, turns };
    }

    // CU-04, steps 5-7 and 6a.
    return { ok: true, turns: [...turns, ...match.playOpponentTurns()] };
  }
}
