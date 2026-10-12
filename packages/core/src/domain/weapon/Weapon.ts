import { WeaponType } from "./WeaponType";

export abstract class Weapon {
  readonly type: WeaponType;
  private ammo: number;
  private uses: number;

  constructor(type: WeaponType, ammo: number) {
    this.type = type;
    this.ammo = ammo;
    this.uses = 0;
  }

  use(): void {
    if (this.ammo === 0) {
      return;
    }

    this.attack();
    this.reduceAmmo();
  }

  remainingAmmo(): number {
    return this.ammo;
  }

  abstract attack(): void;

  private reduceAmmo(): void {
    this.ammo--;
    this.uses++;
  }
}
