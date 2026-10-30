import { Orientation } from "../../fleet/Orientation";
import { ShotRequest } from "../../player/Shot";
import { Coordinate } from "../../shared/Coordinate";
import type { Match } from "../Match";
import { MatchPhase } from "../MatchPhase";
import { MatchRejection, MatchResult } from "../MatchRejection";
import { Turn } from "../Turn";

const WRONG_PHASE = { ok: false, rejection: MatchRejection.WRONG_PHASE } as const;

// State: what the match accepts depends on its phase. Each phase overrides only
// the actions it allows; the rest are rejected here.
export abstract class MatchState {
  abstract readonly phase: MatchPhase;

  placeShip(_match: Match, _index: number, _origin: Coordinate, _orientation: Orientation): MatchResult {
    return WRONG_PHASE;
  }

  removeShip(_match: Match, _index: number): MatchResult {
    return WRONG_PHASE;
  }

  confirmPlacement(_match: Match): MatchResult<{ turns: Turn[] }> {
    return WRONG_PHASE;
  }

  fire(_match: Match, _request: ShotRequest): MatchResult<{ turns: Turn[] }> {
    return WRONG_PHASE;
  }
}
