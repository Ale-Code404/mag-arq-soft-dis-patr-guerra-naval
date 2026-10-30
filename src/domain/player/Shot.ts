import { Coordinate } from "../shared/Coordinate";
import { CellOutcome } from "../weapon/CellOutcome";
import { Weapon } from "../weapon/Weapon";
import { WeaponRejection } from "../weapon/WeaponRejection";
import { WeaponType } from "../weapon/WeaponType";

// What a player decides in its turn: a weapon and a target (RF-07, RF-08).
export type ShotRequest = { weapon: WeaponType; target: Coordinate };

export enum ShotRejection {
  NO_SHOT = "NO_SHOT",
  UNKNOWN_WEAPON = "UNKNOWN_WEAPON",
}

export type Shot =
  | { fired: true; weapon: Weapon; target: Coordinate; outcomes: CellOutcome[] }
  | { fired: false; rejection: ShotRejection | WeaponRejection };
