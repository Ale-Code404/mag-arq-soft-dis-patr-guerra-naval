import { PlacementRejection } from "../board/PlacementRejection";
import { ShotRejection } from "../player/Shot";
import { WeaponRejection } from "../weapon/WeaponRejection";

export enum MatchRejection {
  // The action is not allowed in the current phase (State).
  WRONG_PHASE = "WRONG_PHASE",
  UNKNOWN_SHIP = "UNKNOWN_SHIP",
  UNKNOWN_ORIENTATION = "UNKNOWN_ORIENTATION",
  // CU-03, step 5: every ship must be placed before confirming.
  FLEET_NOT_PLACED = "FLEET_NOT_PLACED",
  // CU-03, 6a and CU-11, 3a1.
  OPPONENT_PLACEMENT_FAILED = "OPPONENT_PLACEMENT_FAILED",
}

export type AnyRejection = MatchRejection | PlacementRejection | ShotRejection | WeaponRejection;

// Every action returns the turns it played: none while placing, the Jugador's
// and the opponent's when firing, or the opponent's opening turn (CU-01, 7a).
export type MatchResult<T = {}> =
  | ({ ok: true } & T)
  | { ok: false; rejection: AnyRejection };
