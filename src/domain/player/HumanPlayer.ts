import { Board } from "../board/Board";
import { Player } from "./Player";
import { ShotRequest } from "./Shot";

export class HumanPlayer extends Player {
  // The Jugador already chose the weapon and target (CU-04, step 1).
  protected chooseShot(_rivalBoard: Board, request?: ShotRequest): ShotRequest | null {
    return request ?? null;
  }
}
