import { Weapon } from "./Weapon";
import { WeaponType } from "./WeaponType";

export class AreaWeapon extends Weapon {
  rows: number;
  columns: number;

  constructor(type: WeaponType, ammo: number, rows: number, columns: number) {
    super(type, ammo);

    this.rows = rows;
    this.columns = columns;
  }

  attack(): void {}
}
