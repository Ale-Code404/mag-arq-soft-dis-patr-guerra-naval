import { MatchPhase } from "../MatchPhase";
import { MatchState } from "./MatchState";

// CU-06: a finished match accepts no more actions.
export class FinishedState extends MatchState {
  readonly phase = MatchPhase.FINISHED;
}
