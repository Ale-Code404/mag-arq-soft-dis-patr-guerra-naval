import { MatchConfigRejection } from "./MatchConfigRejection";
import { Difficulty } from "./Difficulty";
import { FirstTurn } from "./FirstTurn";
import { WeaponType } from "../weapon/WeaponType";

interface MatchConfigInput {
  boardSize: number;
  shipLengths: number[];
  difficulty: Difficulty;
  firstTurn: FirstTurn;
  extraTurnOnHit: boolean;
  enabledWeapons: [weapon: WeaponType, ammo: number][];
}

export type MatchConfigResult =
  | { accepted: true; config: MatchConfig }
  | { accepted: false; rejection: MatchConfigRejection };

export class MatchConfig {
  readonly boardSize: number;
  readonly shipLengths: number[];
  readonly difficulty: Difficulty;
  readonly firstTurn: FirstTurn;
  readonly extraTurnOnHit: boolean;
  readonly enabledWeapons: [weapon: WeaponType, ammo: number][];

  private constructor({
    boardSize,
    shipLengths,
    difficulty,
    firstTurn,
    extraTurnOnHit,
    enabledWeapons,
  }: MatchConfigInput) {
    this.boardSize = boardSize;
    this.shipLengths = shipLengths;
    this.difficulty = difficulty;
    this.firstTurn = firstTurn;
    this.extraTurnOnHit = extraTurnOnHit;
    this.enabledWeapons = enabledWeapons;
  }

  static defaults(): MatchConfig {
    return new MatchConfig({
      boardSize: 8,
      shipLengths: [5, 4, 3, 3, 2],
      difficulty: Difficulty.NORMAL,
      firstTurn: FirstTurn.RANDOM,
      extraTurnOnHit: false,
      enabledWeapons: [
        [WeaponType.BOMB, 2],
        [WeaponType.BOMBER, 2],
        [WeaponType.RECON_PLANE, 2],
        [WeaponType.TORPEDO, 1],
      ],
    });
  }

  static create(input: MatchConfigInput): MatchConfigResult {
    const candidate = new MatchConfig(input);

    if (!candidate.hasKnownValues()) {
      return { accepted: false, rejection: MatchConfigRejection.INVALID_VALUE };
    }

    if (!candidate.isBoardSizeAllowed()) {
      return {
        accepted: false,
        rejection: MatchConfigRejection.BOARD_SIZE_OUT_OF_LIMITS,
      };
    }

    if (!candidate.isFleetAllowed()) {
      return {
        accepted: false,
        rejection: MatchConfigRejection.FLEET_SIZE_OUT_OF_LIMITS,
      };
    }

    if (!candidate.isFleetFitsBoard()) {
      return {
        accepted: false,
        rejection: MatchConfigRejection.FLEET_DOES_NOT_FIT,
      };
    }

    if (!candidate.isArsenalAmmoAllowed()) {
      return {
        accepted: false,
        rejection: MatchConfigRejection.ARSENAL_AMMO_OUT_OF_LIMITS,
      };
    }

    if (!candidate.isArsenalAllowedWeapons()) {
      return {
        accepted: false,
        rejection:
          MatchConfigRejection.ARSENAL_WEAPONS_NOT_CONFIGURABLE_WEAPONS,
      };
    }

    return { accepted: true, config: candidate };
  }

  // The input may come from outside the process (an HTTP body), where the
  // types are not checked: an unknown value is rejected before any rule.
  hasKnownValues(): boolean {
    const isOneOf = (values: object, value: unknown) => Object.values(values).includes(value);

    return (
      Number.isInteger(this.boardSize) &&
      Array.isArray(this.shipLengths) &&
      this.shipLengths.every((length) => Number.isInteger(length)) &&
      isOneOf(Difficulty, this.difficulty) &&
      isOneOf(FirstTurn, this.firstTurn) &&
      typeof this.extraTurnOnHit === "boolean" &&
      Array.isArray(this.enabledWeapons) &&
      this.enabledWeapons.every(
        ([weapon, ammo]) => isOneOf(WeaponType, weapon) && Number.isInteger(ammo),
      )
    );
  }

  isBoardSizeAllowed(): boolean {
    return this.boardSize >= 8 && this.boardSize <= 24;
  }

  isFleetAllowed(): boolean {
    const hasMinimumFleetSize = this.shipLengths.length >= 5;
    const areAllLengthsPositive = this.shipLengths.every(
      (length) => length > 0,
    );

    return hasMinimumFleetSize && areAllLengthsPositive;
  }

  isFleetFitsBoard(): boolean {
    const boardArea = this.boardSize * this.boardSize;
    const fleetArea = this.shipLengths.reduce((acc, length) => acc + length, 0);

    const longestShip = Math.max(...this.shipLengths);

    return (
      longestShip <= this.boardSize && boardArea - fleetArea >= boardArea * 0.3
    );
  }

  isArsenalAmmoAllowed(): boolean {
    const hasMinimumAmmo = this.enabledWeapons.every(([_, ammo]) => ammo >= 1);

    return hasMinimumAmmo;
  }

  isArsenalAllowedWeapons(): boolean {
    return this.enabledWeapons.every(
      ([weapon, _]) => weapon !== WeaponType.MISSILE,
    );
  }
}
