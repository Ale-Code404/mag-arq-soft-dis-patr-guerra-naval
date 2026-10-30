import { Board } from "../board/Board";
import { PlacementRejection } from "../board/PlacementRejection";
import { Fleet } from "../fleet/Fleet";
import { Orientation } from "../fleet/Orientation";
import { Coordinate } from "../shared/Coordinate";
import { CellOutcome } from "../weapon/CellOutcome";
import { Weapon } from "../weapon/Weapon";
import { WeaponType } from "../weapon/WeaponType";
import { Shot, ShotRejection, ShotRequest } from "./Shot";

export abstract class Player {
  name: string;
  board: Board;
  fleet: Fleet;
  weapons: Weapon[];

  constructor(name: string, board: Board, fleet: Fleet, weapons: Weapon[]) {
    this.name = name;
    this.board = board;
    this.fleet = fleet;
    this.weapons = weapons;
  }

  // Template Method: the skeleton of a turn is the same for both sides
  // (CU-04 steps 1-3, CU-12 steps 2-5). Only how the shot is chosen changes.
  takeTurn(rival: Player, request?: ShotRequest): Shot {
    const choice = this.chooseShot(rival.board, request);
    if (choice === null) return { fired: false, rejection: ShotRejection.NO_SHOT };

    const weapon = this.weapon(choice.weapon);
    if (weapon === null) return { fired: false, rejection: ShotRejection.UNKNOWN_WEAPON };

    const use = weapon.use(rival.board, choice.target);
    if (!use.used) return { fired: false, rejection: use.rejection };

    this.learn(use.outcomes);

    return { fired: true, weapon, target: choice.target, outcomes: use.outcomes };
  }

  // Hook: the human brings the shot from outside; the bot computes it.
  protected abstract chooseShot(rivalBoard: Board, request?: ShotRequest): ShotRequest | null;

  // Hook: CU-12, step 5 tells the result to the shooter. Nothing by default.
  protected learn(_outcomes: CellOutcome[]): void {}

  weapon(type: WeaponType): Weapon | null {
    return this.weapons.find((weapon) => weapon.type === type) ?? null;
  }

  placeShip(index: number, origin: Coordinate, orientation: Orientation): PlacementRejection | null {
    return this.board.place(this.fleet.ships[index], origin, orientation);
  }

  removeShip(index: number): void {
    this.board.remove(this.fleet.ships[index]);
  }
}
