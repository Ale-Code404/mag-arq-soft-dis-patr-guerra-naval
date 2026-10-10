import { Weapon } from "./Weapon";

export class AreaWeapon extends Weapon {
  rows: number;
  columns: number;

  constructor(name: string, ammo: number, rows: number, columns: number) {
    super(name, ammo);

    this.rows = rows;
    this.columns = columns;
  }

  attack(): void {}
}
