import { Weapon } from "./Weapon";
import { WeaponType } from "./WeaponType";

export class Torpedo extends Weapon {
  constructor(ammo: number) {
    super(WeaponType.TORPEDO, ammo);
  }

  attack(): void {}
}
